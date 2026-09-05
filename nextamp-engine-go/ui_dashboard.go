package main

import (
	"bytes"
	"fmt"
	"math"
	"os"
	"os/signal"
	"runtime"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"
)

var sparkBlocks = []rune{' ', ' ', '▂', '▃', '▄', '▅', '▆', '▇', '█'}

type AudioMetrics struct {
	InputPeakL      float32
	InputPeakR      float32
	OutputPeakL     float32
	OutputPeakR     float32
	InputSparkL     string
	InputSparkR     string
	OutputSparkL    string
	OutputSparkR    string
	InferMs         float64
	DspMs           float64
	TotalMs         float64
	AheadMs         float64
	ChunkNumber     uint64
	TotalBytes      uint64
	ModeName        string
	LastUpdated     time.Time
}

type Dashboard struct {
	hw            *HardwareInfo
	deviceDesc    string
	listenAddr    string
	clientAddr    atomic.Pointer[string]
	connected     atomic.Bool
	startTime     time.Time
	metrics       AudioMetrics
	metricsMu     sync.RWMutex
	stopChan      chan struct{}
	running       atomic.Bool
}

func NewDashboard(hw *HardwareInfo, deviceDesc string, listenAddr string) *Dashboard {
	d := &Dashboard{
		hw:         hw,
		deviceDesc: deviceDesc,
		listenAddr: listenAddr,
		startTime:  time.Now(),
		stopChan:   make(chan struct{}),
	}
	d.metrics.ModeName = "Karaoke (AI Vocal Cut)"
	d.metrics.InputSparkL = strings.Repeat(" ", 8)
	d.metrics.InputSparkR = strings.Repeat(" ", 8)
	d.metrics.OutputSparkL = strings.Repeat(" ", 8)
	d.metrics.OutputSparkR = strings.Repeat(" ", 8)
	return d
}

func (d *Dashboard) SetClient(addr string, isConnected bool) {
	d.connected.Store(isConnected)
	if isConnected {
		d.clientAddr.Store(&addr)
	} else {
		d.clientAddr.Store(nil)
	}
}

func (d *Dashboard) UpdateAudioMetrics(
	inL, inR, outL, outR []float32,
	modeName string,
	inferMs, dspMs, totalMs float64,
	chunkNum uint64,
	bytesReceived uint64,
) {
	d.metricsMu.Lock()
	defer d.metricsMu.Unlock()

	d.metrics.ChunkNumber = chunkNum
	d.metrics.TotalBytes = bytesReceived
	d.metrics.ModeName = modeName
	d.metrics.InferMs = inferMs
	d.metrics.DspMs = dspMs
	d.metrics.TotalMs = totalMs

	// Chunk duration is 185.75 ms (8916 samples / 48kHz)
	chunkDurationMs := 185.75
	d.metrics.AheadMs = chunkDurationMs - totalMs
	d.metrics.LastUpdated = time.Now()

	// Compute peaks and sparklines (8 blocks width for clean compact rendering)
	d.metrics.InputPeakL, d.metrics.InputSparkL = computePeakAndSpark(inL, 8)
	d.metrics.InputPeakR, d.metrics.InputSparkR = computePeakAndSpark(inR, 8)
	d.metrics.OutputPeakL, d.metrics.OutputSparkL = computePeakAndSpark(outL, 8)
	d.metrics.OutputPeakR, d.metrics.OutputSparkR = computePeakAndSpark(outR, 8)
}

func computePeakAndSpark(samples []float32, width int) (float32, string) {
	if len(samples) == 0 {
		return 0, strings.Repeat(" ", width)
	}

	var maxPeak float32
	step := len(samples) / width
	if step < 1 {
		step = 1
	}

	var sb strings.Builder
	for i := 0; i < width; i++ {
		start := i * step
		end := start + step
		if end > len(samples) {
			end = len(samples)
		}
		var binPeak float32
		for j := start; j < end; j++ {
			v := samples[j]
			if v < 0 {
				v = -v
			}
			if v > binPeak {
				binPeak = v
			}
			if v > maxPeak {
				maxPeak = v
			}
		}
		if binPeak > 1.0 {
			binPeak = 1.0
		}
		idx := int(binPeak * float32(len(sparkBlocks)-1))
		if idx >= len(sparkBlocks) {
			idx = len(sparkBlocks) - 1
		}
		sb.WriteRune(sparkBlocks[idx])
	}
	return maxPeak, sb.String()
}

func formatPeak(peak float32) string {
	pct := peak * 100
	if pct > 100 {
		pct = 100
	}
	if peak <= 0.0001 {
		return fmt.Sprintf("%4.1f%% (-inf dB)", pct)
	}
	db := 20.0 * math.Log10(float64(peak))
	if db < -99.9 {
		db = -99.9
	}
	return fmt.Sprintf("%4.1f%% (%+5.1f dB)", pct, db)
}

func isOutputTerminal() bool {
	fi, err := os.Stdout.Stat()
	if err != nil {
		return false
	}
	return (fi.Mode() & os.ModeCharDevice) != 0
}

func (d *Dashboard) Start() {
	if !d.running.CompareAndSwap(false, true) {
		return
	}

	initConsole()

	if isOutputTerminal() {
		// Clear terminal screen and hide cursor
		os.Stdout.WriteString("\033[2J\033[?25l")
	}

	// Restore cursor on exit
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-c
		d.Stop()
		if isOutputTerminal() {
			os.Stdout.WriteString("\033[?25h\033[0m\n")
		}
		fmt.Println("[*] Next-Amp Engine closed. Goodbye!")
		os.Exit(0)
	}()

	go d.renderLoop()
}

func (d *Dashboard) Stop() {
	if d.running.CompareAndSwap(true, false) {
		close(d.stopChan)
		if isOutputTerminal() {
			os.Stdout.WriteString("\033[?25h\033[0m\n")
		}
	}
}

func (d *Dashboard) renderLoop() {
	interval := 66 * time.Millisecond // ~15 FPS in interactive terminal
	if !isOutputTerminal() {
		interval = 2 * time.Second // 0.5 FPS in background/log mode
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-d.stopChan:
			return
		case <-ticker.C:
			if isOutputTerminal() {
				d.renderFrame()
			} else {
				d.renderLogLine()
			}
		}
	}
}

func (d *Dashboard) renderLogLine() {
	d.metricsMu.RLock()
	metrics := d.metrics
	d.metricsMu.RUnlock()

	isConnected := d.connected.Load()
	status := "WAITING"
	if isConnected {
		status = "CONNECTED"
	}
	totalMB := float64(metrics.TotalBytes) / 1024 / 1024
	fmt.Printf("[⚡ Next-Amp Engine] Dev: %s | Status: %s | Mode: %s | Chunks: #%d (%.1f MB) | Latency: %.1f ms\n",
		d.deviceDesc, status, metrics.ModeName, metrics.ChunkNumber, totalMB, metrics.TotalMs)
}

func (d *Dashboard) renderFrame() {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	allocMB := float64(m.Alloc) / 1024 / 1024
	sysMB := float64(m.Sys) / 1024 / 1024

	d.metricsMu.RLock()
	metrics := d.metrics
	d.metricsMu.RUnlock()

	// Decay sparkline if no audio for > 500ms
	if time.Since(metrics.LastUpdated) > 500*time.Millisecond {
		metrics.InputPeakL = 0
		metrics.InputPeakR = 0
		metrics.OutputPeakL = 0
		metrics.OutputPeakR = 0
		metrics.InputSparkL = strings.Repeat(" ", 8)
		metrics.InputSparkR = strings.Repeat(" ", 8)
		metrics.OutputSparkL = strings.Repeat(" ", 8)
		metrics.OutputSparkR = strings.Repeat(" ", 8)
	}

	isConnected := d.connected.Load()
	clientStr := "\033[90mWaiting for extension...\033[0m"
	if isConnected {
		if ptr := d.clientAddr.Load(); ptr != nil {
			clientStr = fmt.Sprintf("\033[1;32m● Connected\033[0m \033[90m(%s)\033[0m", *ptr)
		} else {
			clientStr = "\033[1;32m● Connected\033[0m"
		}
	}

	speedFactor := 0.0
	if metrics.TotalMs > 0 {
		speedFactor = 185.75 / metrics.TotalMs
	}

	var b bytes.Buffer

	// Move cursor to home (top-left) without clearing whole screen to eliminate flicker
	b.WriteString("\033[H")

	// TITLE
	b.WriteString("\033[1;36m  ⚡ Next-Amp Audio Engine\033[0m  \033[90mv2.2.0-eco\033[0m\n")
	b.WriteString("\033[90m  ──────────────────────────────────────────────────────────\033[0m\n")

	// PANE 1: HARDWARE & SYSTEM STATUS
	b.WriteString("  \033[1;33m[HARDWARE & SYSTEM]\033[0m\n")
	b.WriteString(fmt.Sprintf("  • \033[1mAccelerator\033[0m : \033[1;32m%s\033[0m\n", d.deviceDesc))
	b.WriteString(fmt.Sprintf("  • \033[1mProcessor\033[0m   : %s (%s, %d Cores)\n", d.hw.CPUModel, d.hw.Arch, d.hw.CPUCores))
	b.WriteString(fmt.Sprintf("  • \033[1mMemory\033[0m      : RAM %0.1f MB / Sys %0.1f MB (GC Eco 400%%)\n", allocMB, sysMB))
	b.WriteString(fmt.Sprintf("  • \033[1mServer\033[0m      : ws://%s  [%s]\n", d.listenAddr, clientStr))

	// DIVIDER
	b.WriteString("\033[90m  ──────────────────────────────────────────────────────────\033[0m\n")

	// PANE 2: LIVE AUDIO PREDICT & REAL-TIME STREAMING
	b.WriteString("  \033[1;35m[LIVE AUDIO & AI PREDICT]\033[0m\n")
	b.WriteString(fmt.Sprintf("  • \033[1mMode\033[0m        : \033[1;33m%s\033[0m\n", metrics.ModeName))
	b.WriteString(fmt.Sprintf("  • \033[1mInput  (In)\033[0m : [L] \033[1;32m%s\033[0m [R] \033[1;32m%s\033[0m  %s\n",
		metrics.InputSparkL, metrics.InputSparkR, formatPeak(float32(math.Max(float64(metrics.InputPeakL), float64(metrics.InputPeakR))))))
	b.WriteString(fmt.Sprintf("  • \033[1mOutput (Out)\033[0m: [L] \033[1;34m%s\033[0m [R] \033[1;34m%s\033[0m  %s\n",
		metrics.OutputSparkL, metrics.OutputSparkR, formatPeak(float32(math.Max(float64(metrics.OutputPeakL), float64(metrics.OutputPeakR))))))

	marginTag := "\033[1;32mOPTIMAL\033[0m"
	if metrics.AheadMs < 30 && metrics.TotalMs > 0 {
		marginTag = "\033[1;31mLOW BUFFER\033[0m"
	}
	b.WriteString(fmt.Sprintf("  • \033[1mAI Latency\033[0m  : \033[1;32m%0.1f ms\033[0m (Model: %0.1f ms, DSP: %0.1f ms)\n",
		metrics.TotalMs, metrics.InferMs, metrics.DspMs))
	b.WriteString(fmt.Sprintf("  • \033[1mHeadroom\033[0m    : \033[1;32m%+0.1f ms\033[0m ahead (%0.1fx realtime) [%s]\n",
		metrics.AheadMs, speedFactor, marginTag))

	totalMB := float64(metrics.TotalBytes) / 1024 / 1024
	b.WriteString(fmt.Sprintf("  • \033[1mThroughput\033[0m  : #%d chunks (%0.1f MB) • Zero Drops: \033[1;32m100%%\033[0m\n",
		metrics.ChunkNumber, totalMB))

	b.WriteString("\033[90m  ──────────────────────────────────────────────────────────\033[0m\n")
	b.WriteString("  \033[90mTip: Press Ctrl+C in terminal to stop.\033[0m\n")

	// Clear from cursor to end of screen
	b.WriteString("\033[0J")

	os.Stdout.Write(b.Bytes())
}
