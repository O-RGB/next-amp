package main

import (
	"bufio"
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"time"
)

type DeviceType int

const (
	DeviceCoreML DeviceType = iota
	DeviceDirectML
	DeviceCPU
)

type AccelerationOption struct {
	ID          int
	Type        DeviceType
	Name        string
	DisplayName string
	DeviceIndex int
	Description string
	IsDefault   bool
}

type HardwareInfo struct {
	OSName      string
	Arch        string
	CPUModel    string
	CPUCores    int
	GPUName     string
	GPUCores    string
	Devices     []AccelerationOption
	SelectedDev AccelerationOption
}

func getCPUBrand() string {
	switch runtime.GOOS {
	case "darwin":
		out, err := exec.Command("sysctl", "-n", "machdep.cpu.brand_string").Output()
		if err == nil {
			return strings.TrimSpace(string(out))
		}
	case "windows":
		out, err := exec.Command("wmic", "cpu", "get", "name").Output()
		if err == nil {
			lines := strings.Split(string(out), "\n")
			for _, l := range lines {
				l = strings.TrimSpace(l)
				if l != "" && !strings.EqualFold(l, "name") {
					return l
				}
			}
		}
	case "linux":
		if data, err := os.ReadFile("/proc/cpuinfo"); err == nil {
			for _, line := range strings.Split(string(data), "\n") {
				if strings.HasPrefix(line, "model name") {
					parts := strings.Split(line, ":")
					if len(parts) > 1 {
						return strings.TrimSpace(parts[1])
					}
				}
			}
		}
	}
	return fmt.Sprintf("%s (%s)", runtime.GOARCH, runtime.GOOS)
}

func detectWindowsGPUs() []string {
	var gpus []string
	out, err := exec.Command("powershell", "-NoProfile", "-Command", "Get-CimInstance Win32_VideoController | Select-Object -ExpandProperty Name").Output()
	if err == nil {
		scanner := bufio.NewScanner(bytes.NewReader(out))
		for scanner.Scan() {
			name := strings.TrimSpace(scanner.Text())
			if name != "" && !strings.Contains(strings.ToLower(name), "virtual") {
				gpus = append(gpus, name)
			}
		}
	}
	if len(gpus) == 0 {
		// Fallback to WMIC
		wmicOut, err := exec.Command("wmic", "path", "win32_VideoController", "get", "name").Output()
		if err == nil {
			lines := strings.Split(string(wmicOut), "\n")
			for _, l := range lines {
				l = strings.TrimSpace(l)
				if l != "" && !strings.EqualFold(l, "name") && !strings.Contains(strings.ToLower(l), "virtual") {
					gpus = append(gpus, l)
				}
			}
		}
	}
	return gpus
}

func detectMacOSGPU() (string, string) {
	gpuName := "Apple Silicon GPU"
	gpuCores := ""

	out, err := exec.Command("system_profiler", "SPDisplaysDataType").Output()
	if err == nil {
		for _, line := range strings.Split(string(out), "\n") {
			line = strings.TrimSpace(line)
			if strings.HasPrefix(line, "Chipset Model:") {
				gpuName = strings.TrimSpace(strings.TrimPrefix(line, "Chipset Model:"))
			} else if strings.HasPrefix(line, "Total Number of Cores:") {
				gpuCores = strings.TrimSpace(strings.TrimPrefix(line, "Total Number of Cores:"))
			}
		}
	}
	return gpuName, gpuCores
}

func DetectHardware() *HardwareInfo {
	hw := &HardwareInfo{
		OSName:   runtime.GOOS,
		Arch:     runtime.GOARCH,
		CPUModel: getCPUBrand(),
		CPUCores: runtime.NumCPU(),
	}

	switch runtime.GOOS {
	case "darwin":
		gpuName, gpuCores := detectMacOSGPU()
		hw.GPUName = gpuName
		hw.GPUCores = gpuCores

		coreMLDesc := fmt.Sprintf("%s (Apple Neural Engine + Metal GPU)", gpuName)
		if gpuCores != "" {
			coreMLDesc = fmt.Sprintf("%s (%s Cores GPU + ANE)", gpuName, gpuCores)
		}

		hw.Devices = []AccelerationOption{
			{
				ID:          1,
				Type:        DeviceCoreML,
				Name:        "CoreML",
				DisplayName: coreMLDesc,
				Description: "Zero-load Apple Neural Engine + Metal GPU",
				IsDefault:   true,
			},
			{
				ID:          2,
				Type:        DeviceCPU,
				Name:        "CPU",
				DisplayName: fmt.Sprintf("%s (Eco SIMD 2 Cores)", hw.CPUModel),
				Description: "CPU Fallback (Eco 2-thread cap)",
				IsDefault:   false,
			},
		}

	case "windows":
		gpus := detectWindowsGPUs()
		idCounter := 1

		if len(gpus) > 0 {
			hw.GPUName = gpus[0]
			for idx, gpu := range gpus {
				hw.Devices = append(hw.Devices, AccelerationOption{
					ID:          idCounter,
					Type:        DeviceDirectML,
					Name:        fmt.Sprintf("DirectML #%d", idx),
					DisplayName: fmt.Sprintf("%s (DirectML Device #%d)", gpu, idx),
					DeviceIndex: idx,
					Description: fmt.Sprintf("DirectML GPU Acceleration [Device %d]", idx),
					IsDefault:   idx == 0,
				})
				idCounter++
			}
		} else {
			hw.GPUName = "DirectML Compatible GPU"
			hw.Devices = append(hw.Devices, AccelerationOption{
				ID:          idCounter,
				Type:        DeviceDirectML,
				Name:        "DirectML #0",
				DisplayName: "DirectML GPU (Default Adapter #0)",
				DeviceIndex: 0,
				Description: "Hardware DirectML GPU Acceleration",
				IsDefault:   true,
			})
			idCounter++
		}

		// CPU fallback option
		hw.Devices = append(hw.Devices, AccelerationOption{
			ID:          idCounter,
			Type:        DeviceCPU,
			Name:        "CPU",
			DisplayName: fmt.Sprintf("%s (Eco SIMD 2 Cores)", hw.CPUModel),
			Description: "CPU Fallback (Eco 2-thread cap)",
			IsDefault:   false,
		})

	default:
		hw.GPUName = "Standard CPU/GPU"
		hw.Devices = []AccelerationOption{
			{
				ID:          1,
				Type:        DeviceCPU,
				Name:        "CPU",
				DisplayName: fmt.Sprintf("%s (Eco SIMD 2 Cores)", hw.CPUModel),
				Description: "Eco SIMD Processing",
				IsDefault:   true,
			},
		}
	}

	hw.SelectedDev = hw.Devices[0]
	return hw
}

func isInputTerminal() bool {
	fi, err := os.Stdin.Stat()
	if err != nil {
		return false
	}
	return (fi.Mode() & os.ModeCharDevice) != 0
}

func PromptDeviceSelection(hw *HardwareInfo, forcedDevice string, autoSelectTimeoutSec int) AccelerationOption {
	// If forced flag provided via CLI
	if forcedDevice != "" {
		forced := strings.ToLower(strings.TrimSpace(forcedDevice))
		for _, dev := range hw.Devices {
			if strings.ToLower(dev.Name) == forced ||
				strconv.Itoa(dev.ID) == forced ||
				(forced == "cpu" && dev.Type == DeviceCPU) ||
				(forced == "gpu" && dev.Type == DeviceDirectML) ||
				(forced == "coreml" && dev.Type == DeviceCoreML) ||
				(forced == "ane" && dev.Type == DeviceCoreML) {
				return dev
			}
		}
	}

	defaultDev := hw.Devices[0]
	for _, d := range hw.Devices {
		if d.IsDefault {
			defaultDev = d
			break
		}
	}

	// If not running in an interactive terminal, pick default immediately
	if !isInputTerminal() || autoSelectTimeoutSec <= 0 {
		return defaultDev
	}

	fmt.Println()
	fmt.Println("  \033[1;36m⚡ Next-Amp Engine - Acceleration Device Selector\033[0m")
	fmt.Println("  \033[90m──────────────────────────────────────────────────────────\033[0m")
	fmt.Printf("  • System    : %s (%s, %d Cores)\n", hw.OSName, hw.Arch, hw.CPUCores)
	fmt.Printf("  • Processor : %s\n", hw.CPUModel)
	if hw.GPUName != "" {
		gpuDesc := hw.GPUName
		if hw.GPUCores != "" {
			gpuDesc += fmt.Sprintf(" (%s Cores)", hw.GPUCores)
		}
		fmt.Printf("  • Graphics  : \033[1;32m%s\033[0m\n", gpuDesc)
	}
	fmt.Println("  \033[90m──────────────────────────────────────────────────────────\033[0m")
	fmt.Println("  Available Accelerators:")
	for _, dev := range hw.Devices {
		tag := ""
		if dev.IsDefault {
			tag = " \033[1;32m(Recommended)\033[0m"
		}
		fmt.Printf("    \033[1m[%d]\033[0m %s%s\n", dev.ID, dev.DisplayName, tag)
	}
	fmt.Println("  \033[90m──────────────────────────────────────────────────────────\033[0m")
	fmt.Printf("  Select device [1-%d] (Auto [%d] in %ds): ",
		len(hw.Devices), defaultDev.ID, autoSelectTimeoutSec)

	resultChan := make(chan int, 1)

	go func() {
		reader := bufio.NewReader(os.Stdin)
		text, _ := reader.ReadString('\n')
		text = strings.TrimSpace(text)
		if text == "" {
			resultChan <- defaultDev.ID
			return
		}
		if val, err := strconv.Atoi(text); err == nil {
			resultChan <- val
			return
		}
		resultChan <- defaultDev.ID
	}()

	select {
	case chosenID := <-resultChan:
		for _, d := range hw.Devices {
			if d.ID == chosenID {
				return d
			}
		}
		return defaultDev

	case <-time.After(time.Duration(autoSelectTimeoutSec) * time.Second):
		fmt.Println()
		return defaultDev
	}
}
