package main

import (
	"encoding/binary"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"math"
	"net"
	"net/http"
	"os"
	"os/signal"
	"runtime/debug"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"
	"unsafe"

	"github.com/gorilla/websocket"
	ort "github.com/yalue/onnxruntime_go"
	"nextamp-engine-go/dsp"
)

const (
	ListenAddr         = "127.0.0.1:41919"
	Version            = "2.3.0-eco"
	HeaderBytes        = 8
	DigitalSilencePeak = 3.25e-5
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
	ReadBufferSize:  65536,
	WriteBufferSize: 65536,
}

type HealthResponse struct {
	Status    string `json:"status"`
	Engine    string `json:"engine"`
	Version   string `json:"version"`
	AIEnabled bool   `json:"ai_enabled"`
	Device    string `json:"device"`
	Error     string `json:"error,omitempty"`
	Timestamp int64  `json:"timestamp"`
}

type AIEngine struct {
	mu             sync.Mutex
	session        *ort.AdvancedSession
	inputTensor    *ort.Tensor[float32]
	outputTensor   *ort.Tensor[float32]
	dspEngine      *dsp.Engine
	modelData      []byte
	enabled        bool
	deviceInfo     string
	recoveryTried  bool
	runErrorLogged bool
}

var (
	globalAI            *AIEngine
	globalDashboard     *Dashboard
	aiInitError         string
	totalChunksReceived atomic.Uint64
	totalBytesReceived  atomic.Uint64
	lastStatusTime      time.Time
	muStatus            sync.Mutex
	coreMLComputeUnits  = "ALL"
	coreMLProfile       bool
	ortProfilePrefix    string
)

func cpuFallbackDevice(dev AccelerationOption) AccelerationOption {
	dev.Type = DeviceCPU
	dev.Name = "CPU"
	dev.DeviceIndex = 0
	dev.DisplayName = fmt.Sprintf("%s (Fallback to CPU)", dev.DisplayName)
	dev.Description = "CPU Fallback (Eco 2-thread cap)"
	return dev
}

func createSessionOptions(dev AccelerationOption) (*ort.SessionOptions, string, error) {
	opts, deviceLabel, err := createSessionOptionsForCoreML(dev, coreMLComputeUnits, coreMLProfile)
	if err != nil {
		return nil, "", err
	}
	if strings.TrimSpace(ortProfilePrefix) != "" {
		if err := opts.EnableProfiling(ortProfilePrefix); err != nil {
			opts.Destroy()
			return nil, "", err
		}
	}
	return opts, deviceLabel, nil
}

func createSessionOptionsForCoreML(dev AccelerationOption, computeUnits string, profileComputePlan bool) (*ort.SessionOptions, string, error) {
	opts, err := ort.NewSessionOptions()
	if err != nil {
		return nil, "", err
	}

	// High-Performance Graph Optimization. DirectML requires sequential
	// execution with memory-pattern allocation disabled; leaving the generic
	// ORT defaults here can make older Windows GPUs stall or fail at runtime.
	if err := opts.SetGraphOptimizationLevel(ort.GraphOptimizationLevelEnableAll); err != nil {
		opts.Destroy()
		return nil, "", err
	}
	if err := opts.SetCpuMemArena(true); err != nil {
		opts.Destroy()
		return nil, "", err
	}
	if err := opts.SetExecutionMode(ort.ExecutionModeSequential); err != nil {
		opts.Destroy()
		return nil, "", err
	}
	useMemPattern := dev.Type != DeviceDirectML
	if err := opts.SetMemPattern(useMemPattern); err != nil {
		opts.Destroy()
		return nil, "", err
	}
	if err := opts.AddSessionConfigEntry("session.intra_op.allow_spinning", "0"); err != nil {
		opts.Destroy()
		return nil, "", err
	}

	deviceLabel := dev.DisplayName
	switch dev.Type {
	case DeviceCoreML:
		// Hardware Acceleration on Apple Silicon / macOS via CoreML. This model
		// contains an AvgPool form that the bundled CoreML parser cannot compile
		// as MLProgram (it reports a missing `pad` parameter), so keep the
		// provider-aware NeuralNetwork format for the exact FP32 graph.
		if strings.TrimSpace(computeUnits) == "" {
			computeUnits = "ALL"
		}
		coreMLOptions := map[string]string{
			"ModelFormat":                        "NeuralNetwork",
			"MLComputeUnits":                     computeUnits,
			"RequireStaticInputShapes":           "1",
			"SpecializationStrategy":             "FastPrediction",
			"AllowLowPrecisionAccumulationOnGPU": "0",
		}
		if profileComputePlan {
			coreMLOptions["ProfileComputePlan"] = "1"
		}
		err = opts.AppendExecutionProviderCoreMLV2(coreMLOptions)
	case DeviceDirectML:
		// Hardware Acceleration on Windows via DirectML (GPU)
		err = opts.AppendExecutionProviderDirectML(dev.DeviceIndex)
	case DeviceCPU:
		// Keep the CPU fallback bounded so it does not consume every core.
		err = opts.SetIntraOpNumThreads(2)
	}

	if err != nil && dev.Type != DeviceCPU {
		// Provider registration can succeed on an old driver while the actual
		// graph/session is still unsupported. Rebuild clean CPU-only options.
		opts.Destroy()
		fallback := cpuFallbackDevice(dev)
		fallbackOpts, fallbackLabel, fallbackErr := createSessionOptions(fallback)
		if fallbackErr != nil {
			return nil, "", fmt.Errorf("%w; CPU fallback setup failed: %v", err, fallbackErr)
		}
		return fallbackOpts, fallbackLabel, nil
	}
	if err != nil {
		opts.Destroy()
		return nil, "", err
	}

	return opts, deviceLabel, nil
}

func createORTSession(modelData []byte, dev AccelerationOption) (*ort.AdvancedSession, *ort.Tensor[float32], *ort.Tensor[float32], string, error) {
	opts, deviceLabel, err := createSessionOptions(dev)
	if err != nil {
		return nil, nil, nil, "", err
	}
	defer opts.Destroy()

	inputShape := ort.NewShape(1, 1024, 64, 2)
	dummyInput := make([]float32, 1*1024*64*2)
	inputTensor, err := ort.NewTensor(inputShape, dummyInput)
	if err != nil {
		return nil, nil, nil, "", fmt.Errorf("failed to create input tensor: %w", err)
	}

	outputShape := ort.NewShape(1, 1024, 64, 2)
	outputTensor, err := ort.NewEmptyTensor[float32](outputShape)
	if err != nil {
		inputTensor.Destroy()
		return nil, nil, nil, "", fmt.Errorf("failed to create output tensor: %w", err)
	}

	// Load directly from decrypted memory bytes without touching disk.
	session, err := ort.NewAdvancedSessionWithONNXData(
		modelData,
		[]string{"input"},
		[]string{"Identity"},
		[]ort.Value{inputTensor},
		[]ort.Value{outputTensor},
		opts,
	)
	if err != nil {
		outputTensor.Destroy()
		inputTensor.Destroy()
		return nil, nil, nil, "", err
	}

	return session, inputTensor, outputTensor, deviceLabel, nil
}

func initAIEngine(dev AccelerationOption) (*AIEngine, error) {
	libPath, err := findOrExtractLibrary()
	if err != nil {
		return nil, fmt.Errorf("runtime library error: %w", err)
	}

	modelData, err := loadDecryptedModel()
	if err != nil {
		return nil, fmt.Errorf("failed to load encrypted model: %w", err)
	}

	ort.SetSharedLibraryPath(libPath)
	err = ort.InitializeEnvironment()
	if err != nil {
		return nil, fmt.Errorf("failed to init ONNX Runtime from %s: %w", libPath, err)
	}

	session, inputTensor, outputTensor, deviceLabel, err := createORTSession(modelData, dev)
	if err != nil && dev.Type != DeviceCPU {
		// A DirectML/CoreML provider may register successfully but fail while
		// partitioning this particular graph. Retry the exact same float model
		// on CPU before giving up, preserving audio quality.
		fmt.Printf("[!] %s session failed; retrying with CPU: %v\n", dev.DisplayName, err)
		session, inputTensor, outputTensor, deviceLabel, err = createORTSession(modelData, cpuFallbackDevice(dev))
	}
	if err != nil {
		ort.DestroyEnvironment()
		return nil, fmt.Errorf("failed to initialize ONNX session: %w", err)
	}

	// Warmup is part of validation. If hardware execution fails here, retry
	// with the same model on CPU instead of silently serving a broken stream.
	warmupErr := session.Run()
	if warmupErr != nil && dev.Type != DeviceCPU {
		session.Destroy()
		inputTensor.Destroy()
		outputTensor.Destroy()
		fmt.Printf("[!] %s warmup failed; retrying with CPU: %v\n", dev.DisplayName, warmupErr)
		session, inputTensor, outputTensor, deviceLabel, warmupErr = func() (*ort.AdvancedSession, *ort.Tensor[float32], *ort.Tensor[float32], string, error) {
			return createORTSession(modelData, cpuFallbackDevice(dev))
		}()
		if warmupErr == nil {
			warmupErr = session.Run()
		}
	}
	if warmupErr != nil {
		if session != nil {
			session.Destroy()
		}
		if inputTensor != nil {
			inputTensor.Destroy()
		}
		if outputTensor != nil {
			outputTensor.Destroy()
		}
		ort.DestroyEnvironment()
		return nil, fmt.Errorf("ONNX warmup failed: %w", warmupErr)
	}

	return &AIEngine{
		session:      session,
		inputTensor:  inputTensor,
		outputTensor: outputTensor,
		dspEngine:    dsp.NewEngine(),
		modelData:    modelData,
		enabled:      true,
		deviceInfo:   deviceLabel,
	}, nil
}

// recoverWithCPU rebuilds the inference session with the bounded CPU provider
// after a hardware/provider failure. Some Windows DirectML drivers accept the
// provider during session creation but fail only when real audio is executed.
// Keep this recovery outside the audio DSP path's normal allocation budget; it
// is attempted at most once for the lifetime of the engine.
func (ai *AIEngine) recoverWithCPU() error {
	if ai == nil || ai.recoveryTried {
		return fmt.Errorf("CPU recovery already attempted")
	}
	ai.recoveryTried = true
	if len(ai.modelData) == 0 {
		return fmt.Errorf("decrypted model is no longer available for CPU recovery")
	}

	cpuDev := AccelerationOption{
		Type:        DeviceCPU,
		Name:        "CPU",
		DisplayName: "CPU (Eco SIMD 2 Cores)",
	}
	newSession, newInput, newOutput, deviceLabel, err := createORTSession(ai.modelData, cpuDev)
	if err != nil {
		return fmt.Errorf("CPU session creation failed: %w", err)
	}
	if err := newSession.Run(); err != nil {
		newSession.Destroy()
		newInput.Destroy()
		newOutput.Destroy()
		return fmt.Errorf("CPU warmup failed: %w", err)
	}

	oldSession := ai.session
	oldInput := ai.inputTensor
	oldOutput := ai.outputTensor
	ai.session = newSession
	ai.inputTensor = newInput
	ai.outputTensor = newOutput
	ai.deviceInfo = deviceLabel
	ai.modelData = nil

	if oldSession != nil {
		oldSession.Destroy()
	}
	if oldInput != nil {
		oldInput.Destroy()
	}
	if oldOutput != nil {
		oldOutput.Destroy()
	}
	debug.FreeOSMemory()

	fmt.Printf("[✓] Recovered ONNX inference on %s after provider failure.\n", deviceLabel)
	return nil
}

func (ai *AIEngine) Close() {
	if ai == nil {
		return
	}
	ai.mu.Lock()
	defer ai.mu.Unlock()
	if ai.session != nil {
		ai.session.Destroy()
		ai.session = nil
	}
	if ai.inputTensor != nil {
		ai.inputTensor.Destroy()
		ai.inputTensor = nil
	}
	if ai.outputTensor != nil {
		ai.outputTensor.Destroy()
		ai.outputTensor = nil
	}
	for i := range ai.modelData {
		ai.modelData[i] = 0
	}
	ai.modelData = nil
	ort.DestroyEnvironment()
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	aiActive := globalAI != nil && globalAI.enabled
	dev := "Loopback DSP"
	statusError := ""
	if aiActive {
		dev = globalAI.deviceInfo
	} else {
		statusError = aiInitError
	}

	json.NewEncoder(w).Encode(HealthResponse{
		Status:    "running",
		Engine:    "Next-Amp Go Native Engine (Eco AI)",
		Version:   Version,
		AIEnabled: aiActive,
		Device:    dev,
		Error:     statusError,
		Timestamp: time.Now().UnixMilli(),
	})
}

// Zero-Copy Sample Unpacking: instant direct cast using unsafe.Slice
func parseChannelSamples(payload []byte) ([]float32, []float32) {
	numBytes := len(payload) - HeaderBytes
	numSamples := numBytes / 8
	leftBytes := payload[HeaderBytes : HeaderBytes+numSamples*4]
	rightBytes := payload[HeaderBytes+numSamples*4 : HeaderBytes+numSamples*8]

	left := unsafe.Slice((*float32)(unsafe.Pointer(&leftBytes[0])), numSamples)
	right := unsafe.Slice((*float32)(unsafe.Pointer(&rightBytes[0])), numSamples)
	return left, right
}

// Zero-Copy Sample Packing
func packChannelSamples(chunkIndex uint32, mode uint8, streamToken uint16, left, right []float32, buf []byte) []byte {
	numSamples := len(left)
	totalBytes := HeaderBytes + (numSamples * 8)
	if len(buf) < totalBytes {
		buf = make([]byte, totalBytes)
	} else {
		buf = buf[:totalBytes]
	}

	binary.LittleEndian.PutUint32(buf[0:4], chunkIndex)
	buf[4] = mode
	buf[5] = 0
	binary.LittleEndian.PutUint16(buf[6:8], streamToken)

	lByteSlice := unsafe.Slice((*byte)(unsafe.Pointer(&left[0])), numSamples*4)
	rByteSlice := unsafe.Slice((*byte)(unsafe.Pointer(&right[0])), numSamples*4)

	copy(buf[HeaderBytes:HeaderBytes+numSamples*4], lByteSlice)
	copy(buf[HeaderBytes+numSamples*4:HeaderBytes+numSamples*8], rByteSlice)

	return buf
}

// packSilentSamples is the safe failure output for an AI packet. Returning
// the input here would leak the original vocal whenever ONNX Runtime has a
// transient provider/scheduling error.
func packSilentSamples(chunkIndex uint32, mode uint8, streamToken uint16, numSamples int, buf []byte) []byte {
	totalBytes := HeaderBytes + (numSamples * 8)
	if len(buf) < totalBytes {
		buf = make([]byte, totalBytes)
	} else {
		buf = buf[:totalBytes]
	}

	binary.LittleEndian.PutUint32(buf[0:4], chunkIndex)
	buf[4] = mode
	buf[5] = 0
	binary.LittleEndian.PutUint16(buf[6:8], streamToken)
	for i := HeaderBytes; i < totalBytes; i++ {
		buf[i] = 0
	}
	return buf
}

// Lightweight Eco Status Display: updates smoothly once per second with zero terminal overhead
func printEcoStatus(chunkIndex uint32, mode uint8, elapsedMs float64, leftSamples []float32) {
	muStatus.Lock()
	defer muStatus.Unlock()

	now := time.Now()
	if now.Sub(lastStatusTime) < 1000*time.Millisecond {
		return
	}
	lastStatusTime = now

	// Calculate peak
	var peak float32
	for i := 0; i < len(leftSamples); i += 16 { // subsample for 0% CPU
		v := float32(math.Abs(float64(leftSamples[i])))
		if v > peak {
			peak = v
		}
	}

	modeStr := "Bypass"
	if mode == 1 {
		modeStr = "Karaoke (AI Cut)"
	} else if mode == 2 {
		modeStr = "Acapella (AI Iso)"
	}

	totalMB := float64(totalBytesReceived.Load()) / (1024 * 1024)
	fmt.Printf("[⚡ Eco Engine] Mode: \033[1;36m%-18s\033[0m | Chunk: #%-5d | Latency: \033[1;32m%5.1f ms\033[0m | Peak: \033[1;33m%2.0f%%\033[0m | Data: %0.1f MB\n",
		modeStr, chunkIndex, elapsedMs, peak*100, totalMB)
}

func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[!] Upgrade error: %v\n", err)
		return
	}
	defer conn.Close()

	if tcpConn, ok := conn.UnderlyingConn().(*net.TCPConn); ok {
		tcpConn.SetNoDelay(true)
		tcpConn.SetReadBuffer(131072)
		tcpConn.SetWriteBuffer(131072)
	}

	clientAddr := conn.RemoteAddr().String()
	if globalDashboard != nil {
		globalDashboard.SetClient(clientAddr, true)
		defer globalDashboard.SetClient("", false)
	} else {
		fmt.Printf("\n[+] \033[1;32mNext-Amp Connected!\033[0m (%s)\n", clientAddr)
		defer fmt.Println("\n[-] Next-Amp Client Disconnected")
	}

	devInfo := "Go Native Core (Loopback)"
	if globalAI != nil && globalAI.enabled {
		devInfo = globalAI.deviceInfo
	} else if aiInitError != "" {
		devInfo = "AI unavailable (see engine console)"
	}

	// Send Welcome Handshake
	welcomeMsg := map[string]interface{}{
		"type":       "READY",
		"engine":     "Next-Amp Go Native Engine (Eco AI)",
		"version":    Version,
		"device":     devInfo,
		"ai_enabled": globalAI != nil && globalAI.enabled,
		"error":      aiInitError,
	}
	conn.WriteJSON(welcomeMsg)

	// Reset DSP state on new client connection
	if globalAI != nil {
		globalAI.mu.Lock()
		globalAI.dspEngine.Reset()
		globalAI.mu.Unlock()
	}

	// The extension uses one fixed 8,192-sample packet for the native path.
	// Reuse one exact-size receive buffer as well as the response buffer so a
	// busy Windows/Apple machine does not create a new ~64 KiB payload on every
	// WebSocket message.
	packetBuf := make([]byte, HeaderBytes+(dsp.ChunkSamples*8))
	outBuf := make([]byte, HeaderBytes+(dsp.ChunkSamples*8))
	// Keep the safe failure output allocation outside the audio loop. These
	// buffers are only exposed to the dashboard on an inference/provider error;
	// the WebSocket response itself is still zeroed by packSilentSamples.
	silenceL := make([]float32, dsp.ChunkSamples)
	silenceR := make([]float32, dsp.ChunkSamples)
	conn.SetReadLimit(int64(len(packetBuf)))

	for {
		messageType, messageReader, err := conn.NextReader()
		if err != nil {
			break
		}

		if messageType == websocket.BinaryMessage {
			// ReadFull also handles a smaller valid packet: it returns the bytes
			// read with io.ErrUnexpectedEOF at the WebSocket message boundary.
			packetLen, readErr := io.ReadFull(messageReader, packetBuf)
			if packetLen == len(packetBuf) {
				// Reject oversized packets without allowing leftover bytes to be
				// interpreted as a second audio message on the next iteration.
				var extra [1]byte
				if extraLen, _ := messageReader.Read(extra[:]); extraLen > 0 {
					continue
				}
			}
			if packetLen == 0 || (readErr != nil && readErr != io.EOF && readErr != io.ErrUnexpectedEOF) {
				continue
			}
			payload := packetBuf[:packetLen]
			t0 := time.Now()
			chunkLen := packetLen

			if chunkLen <= HeaderBytes || (chunkLen-HeaderBytes)%8 != 0 {
				continue
			}

			chunkIndex := binary.LittleEndian.Uint32(payload[0:4])
			mode := payload[4]
			streamToken := binary.LittleEndian.Uint16(payload[6:8])

			totalChunksReceived.Add(1)
			totalBytesReceived.Add(uint64(chunkLen))

			leftSamples, rightSamples := parseChannelSamples(payload)

			var outL, outR []float32
			var respPayload []byte
			var inferMs, dspMs float64

			if (mode == 1 || mode == 2) && globalAI != nil && globalAI.enabled {
				// Process with Hardware-Accelerated AI Vocal Separation Pipeline
				globalAI.mu.Lock()

				tDSP1 := time.Now()
				// 1. Forward STFT + Peak Tracking + Normalization (~0.25ms via SIMD)
				normInput := globalAI.dspEngine.StepForward(leftSamples, rightSamples)
				dspMs += float64(time.Since(tDSP1).Microseconds()) / 1000.0
				delayChunks := int(payload[5])
				if delayChunks > 3 {
					delayChunks = 0
				}

				// A delayed target that is already at the digital-silence floor still
				// needs StepBackward so the STFT/lookahead/OLA timeline advances, but
				// it does not need an ONNX run. The old gate happened before
				// StepForward and could leave the native state one chunk behind.
				targetIsDigitalSilence := globalAI.dspEngine.TargetChunkIsDigitalSilence(delayChunks, DigitalSilencePeak)
				if targetIsDigitalSilence {
					tDSP2 := time.Now()
					outL, outR = globalAI.dspEngine.StepBackwardSilence(delayChunks)
					dspMs += float64(time.Since(tDSP2).Microseconds()) / 1000.0
					respPayload = packChannelSamples(chunkIndex, mode, streamToken, outL, outR, outBuf)
				} else {
					// 2. Load into ONNX Tensor buffer
					tensorBuf := globalAI.inputTensor.GetData()
					copy(tensorBuf, normInput)

					// 3. Neural Network U-Net Inference (~50ms via CoreML/DirectML)
					tNN := time.Now()
					runErr := globalAI.session.Run()
					inferMs = float64(time.Since(tNN).Microseconds()) / 1000.0

					if runErr != nil {
						if !globalAI.runErrorLogged {
							fmt.Printf("[!] ONNX inference failed on %s at chunk #%d: %v\n", globalAI.deviceInfo, chunkIndex, runErr)
							globalAI.runErrorLogged = true
						}
						if !globalAI.recoveryTried {
							if recoveryErr := globalAI.recoverWithCPU(); recoveryErr == nil {
								// The replacement session owns a new input tensor; replay the
								// current normalized chunk instead of dropping it.
								copy(globalAI.inputTensor.GetData(), normInput)
								runErr = globalAI.session.Run()
								if runErr != nil {
									fmt.Printf("[!] CPU recovery inference failed at chunk #%d: %v\n", chunkIndex, runErr)
								}
							} else {
								fmt.Printf("[!] CPU recovery unavailable at chunk #%d: %v\n", chunkIndex, recoveryErr)
							}
						}
					}

					if runErr != nil {
						outL = silenceL[:len(leftSamples)]
						outR = silenceR[:len(rightSamples)]
						respPayload = packSilentSamples(chunkIndex, mode, streamToken, len(leftSamples), outBuf)
					} else {
						// 4. Inverse STFT + Fast C SIMD Sigmoid + Overlap-Add (~0.06ms via SIMD)
						tDSP2 := time.Now()
						rawOut := globalAI.outputTensor.GetData()
						outL, outR = globalAI.dspEngine.StepBackward(rawOut, delayChunks, int(mode), 1.0)
						dspMs += float64(time.Since(tDSP2).Microseconds()) / 1000.0
						respPayload = packChannelSamples(chunkIndex, mode, streamToken, outL, outR, outBuf)
					}
				}
				globalAI.mu.Unlock()
			} else {
				if mode == 1 || mode == 2 {
					// Never expose raw audio when an AI mode is requested but the
					// native session is unavailable. Silence is the safe output.
					outL = silenceL[:len(leftSamples)]
					outR = silenceR[:len(rightSamples)]
					respPayload = packSilentSamples(chunkIndex, mode, streamToken, len(leftSamples), outBuf)
				} else {
					// Bypass Mode (raw zero-latency loopback)
					outL, outR = leftSamples, rightSamples
					respPayload = payload
				}
			}

			elapsedMs := float64(time.Since(t0).Microseconds()) / 1000.0

			// Send processed chunk back immediately to AudioWorklet
			err = conn.WriteMessage(websocket.BinaryMessage, respPayload)
			if err != nil {
				break
			}

			// Update dashboard metrics or fallback status
			if globalDashboard != nil {
				modeStr := "Bypass (DSP Loopback)"
				if mode == 1 {
					modeStr = "Karaoke (AI Vocal Cut)"
				} else if mode == 2 {
					modeStr = "Acapella (AI Vocal Isolate)"
				}
				globalDashboard.UpdateAudioMetrics(
					leftSamples, rightSamples,
					outL, outR,
					modeStr,
					inferMs, dspMs, elapsedMs,
					uint64(chunkIndex),
					totalBytesReceived.Load(),
				)
			} else {
				printEcoStatus(chunkIndex, mode, elapsedMs, outL)
			}

		} else if messageType == websocket.TextMessage {
			payload, readErr := io.ReadAll(messageReader)
			if readErr != nil {
				continue
			}
			var msg map[string]interface{}
			if err := json.Unmarshal(payload, &msg); err == nil {
				if msg["type"] == "PING" {
					conn.WriteJSON(map[string]interface{}{
						"type":      "PONG",
						"timestamp": time.Now().UnixMilli(),
					})
				} else if msg["type"] == "RESET_STREAM" {
					// A sustained input silence marks a song/stream boundary.
					// Clear STFT history, lookahead spectra, rolling magnitudes,
					// and overlap tails before the next song enters the model.
					if globalAI != nil {
						globalAI.mu.Lock()
						globalAI.dspEngine.Reset()
						globalAI.mu.Unlock()
					}
					conn.WriteJSON(map[string]interface{}{
						"type": "STREAM_RESET_ACK",
					})
				}
			}
		}
	}
}

func main() {
	flagDevice := flag.String("device", "", "Select acceleration device ('auto', 'cpu', 'coreml', 'directml', or device ID 1, 2, ...)")
	flagTimeout := flag.Int("timeout", 3, "Countdown seconds for interactive device selection prompt (0 to skip)")
	flagAddr := flag.String("addr", ListenAddr, "WebSocket listen address")
	flagHeadless := flag.Bool("headless", false, "Disable interactive TUI dashboard")
	flagCoreMLUnits := flag.String("coreml-units", "ALL", "CoreML compute units: ALL, CPUAndNeuralEngine, CPUAndGPU, or CPUOnly")
	flagCoreMLProfile := flag.Bool("coreml-profile", false, "Enable CoreML compute-plan diagnostics (debug only)")
	flagORTProfile := flag.String("ort-profile", "", "Write an ONNX Runtime Chrome-trace profile to this file prefix (debug only)")
	flag.Parse()
	coreMLComputeUnits = strings.TrimSpace(*flagCoreMLUnits)
	coreMLProfile = *flagCoreMLProfile
	ortProfilePrefix = strings.TrimSpace(*flagORTProfile)

	// Set Go runtime garbage collection and memory tuning for minimal footprint & zero GC pauses
	debug.SetGCPercent(400)

	// 1. Detect hardware
	hw := DetectHardware()

	// 2. Select device (interactive prompt or CLI flag)
	selectedDev := PromptDeviceSelection(hw, *flagDevice, *flagTimeout)

	// 3. Initialize AI Engine
	ai, err := initAIEngine(selectedDev)
	if err != nil {
		aiInitError = err.Error()
		fmt.Printf("\033[1;33mWARNING\033[0m: %v\n", err)
		fmt.Println("[!] Running in High-Speed Loopback Mode (without AI).")
	} else {
		globalAI = ai
	}

	// 4. Initialize and Start Dashboard
	if !*flagHeadless {
		dashboardDevice := selectedDev.DisplayName
		if ai != nil {
			// Show the device that actually owns the initialized ORT session.
			// This prevents a failed CoreML/DirectML partition from being
			// presented as hardware acceleration after CPU fallback.
			dashboardDevice = ai.deviceInfo
		}
		globalDashboard = NewDashboard(hw, dashboardDevice, *flagAddr)
		globalDashboard.Start()
		defer globalDashboard.Stop()
	} else {
		fmt.Printf("[✓] Native Engine listening on ws://%s/ws [%s]\n", *flagAddr, selectedDev.DisplayName)
	}

	http.HandleFunc("/ws", handleWebSocket)
	http.HandleFunc("/health", handleHealth)

	server := &http.Server{
		Addr: *flagAddr,
	}

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			if !*flagHeadless && globalDashboard != nil {
				globalDashboard.Stop()
			}
			log.Fatalf("[!] Listen error: %v\n", err)
		}
	}()

	<-sigChan
	if !*flagHeadless && globalDashboard != nil {
		globalDashboard.Stop()
	}
	if globalAI != nil {
		globalAI.Close()
	}
	server.Close()
}
