package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	nvml "github.com/mindprince/gonvml"
	"github.com/shirou/gopsutil/cpu"
	"github.com/shirou/gopsutil/disk"
	"github.com/shirou/gopsutil/host"
	"github.com/shirou/gopsutil/mem"
)

func removeHistoricalDataFile() {
	err := os.Remove("json/historical_data.json")
	if err != nil && !os.IsNotExist(err) {
		log.Printf("Failed to remove historical data file: %v\n", err)
	}
}

type Config struct {
	ServerPort            int `json:"port"`
	UpdateIntervalSeconds int `json:"update_interval_seconds"`
	TickerIntervalSeconds int `json:"save_history_seconds"`
}

type HistoricalData struct {
	HistoricalData []struct {
		Timestamp     string  `json:"timestamp"`
		CPUHistory    float64 `json:"cpu_history"`
		MemoryHistory float64 `json:"memory_history"`
		// Add more fields for other parameters if needed
	} `json:"historical_data"`
}

var (
	historicalData      HistoricalData           // Declare a global variable to store historical data
	previousDiskStats   map[string]disk.IOCountersStat // Store previous disk stats for calculating speeds
	mutex               sync.Mutex                     // Ensure thread safety
)

func startTrayIcon() {
	if runtime.GOOS == "windows" {
		cmd := exec.Command("powershell.exe", "-File", "Trayicon/trayicon.ps1")
		cmd.Stderr = os.Stderr // Capture standard errors
		cmd.Stdout = os.Stdout // Capture standard output
		err := cmd.Start()
		if err != nil {
			log.Fatalf("Failed to start tray icon script: %v", err)
		}
	} else {
		log.Println("Tray icon script is not supported on non-Windows platforms.")
	}
}

// Function to load historical data from a file
func loadHistoricalDataFromFile() error {
	file, err := os.Open("json/historical_data.json")
	if err != nil {
		return err
	}
	defer file.Close()

	decoder := json.NewDecoder(file)
	if err := decoder.Decode(&historicalData); err != nil {
		return err
	}

	return nil
}

// Handler to save new historical data
func saveHistoricalData(w http.ResponseWriter, r *http.Request) {
	// Parse request body to get new historical data
	var newData HistoricalData
	err := json.NewDecoder(r.Body).Decode(&newData)
	if err != nil {
		http.Error(w, "Failed to decode JSON", http.StatusBadRequest)
		return
	}

	// Update the global historical data
	historicalData = newData

	// Save the historical data to a file
	if err := saveHistoricalDataToFile(); err != nil {
		http.Error(w, "Failed to save historical data to file", http.StatusInternalServerError)
		return
	}

	// Respond with success message
	w.WriteHeader(http.StatusOK)
}

// Handler to serve historical data
func serveHistoricalData(w http.ResponseWriter, r *http.Request) {
	// Load historical data from file
	if err := loadHistoricalDataFromFile(); err != nil {
		http.Error(w, "Failed to load historical data from file", http.StatusInternalServerError)
		return
	}

	// Convert historical data to JSON and send it in the response
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(historicalData)
}

func main() {
	removeHistoricalDataFile()

	// Get the config file
	configFile, err := os.Open("json/config.json") // Assuming config.json is in the same directory as the executable
	if err != nil {
		fmt.Println("Can't open config file:", err)
		return
	}
	defer configFile.Close()

	var config Config
	err = json.NewDecoder(configFile).Decode(&config)
	if err != nil {
		fmt.Println("Can't open config file:", err)
		return
	}

	// Initialize the previous disk stats map
	previousDiskStats = make(map[string]disk.IOCountersStat)

	// Start a goroutine to collect and store historical data periodically
	go saveHistoricalDataPeriodically(config)

	mux := http.NewServeMux()

	// Register endpoint handlers
	mux.HandleFunc("/save_historical_data", saveHistoricalData)
	mux.HandleFunc("/history", serveHistoricalData)
	mux.HandleFunc("/system_info", systemInfoHandler)

	startTrayIcon()

	// Web server
	websiteDir := filepath.Join(".", "Website")
	fs := http.FileServer(http.Dir(websiteDir))
	mux.Handle("/", fs)
	mux.Handle("/cpu", http.FileServer(http.Dir(filepath.Join(websiteDir, "cpu.html")))) // Serve the new CPU page

	fmt.Printf("Server started at http://localhost:%d\n", config.ServerPort)
	err = http.ListenAndServe(fmt.Sprintf(":%d", config.ServerPort), mux)
	if err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

// Function to collect and store historical data periodically
func saveHistoricalDataPeriodically(config Config) {
	ticker := time.NewTicker(time.Duration(config.TickerIntervalSeconds) * time.Second) // Ticker to collect data every specified interval
	defer ticker.Stop()

	for {
		<-ticker.C // Wait for the ticker to tick (every specified interval)

		// Collect current CPU and memory data
		cpuUsage, _ := cpu.Percent(0, false)
		memoryUsage, _ := mem.VirtualMemory()

		// Create a timestamp in the format "MM/dd/yyyy HH:mm:ss"
		timestamp := time.Now().Format("01/02/2006 15:04:05")

		// Add the new historical data to the list
		newData := struct {
			Timestamp     string  `json:"timestamp"`
			CPUHistory    float64 `json:"cpu_history"`
			MemoryHistory float64 `json:"memory_history"`
		}{
			Timestamp:     timestamp,
			CPUHistory:    cpuUsage[0],
			MemoryHistory: memoryUsage.UsedPercent,
		}
		historicalData.HistoricalData = append(historicalData.HistoricalData, newData)

		// Save the historical data to a file
		if err := saveHistoricalDataToFile(); err != nil {
			log.Printf("Failed to save historical data: %v\n", err)
			continue // Continue to the next iteration if there's an error saving the data
		}
	}
}

func systemInfoHandler(w http.ResponseWriter, r *http.Request) {
	configFile, err := os.Open("json/config.json")
	if err != nil {
		http.Error(w, "Can't open config file", http.StatusInternalServerError)
		return
	}
	defer configFile.Close()

	var config Config
	err = json.NewDecoder(configFile).Decode(&config)
	if err != nil {
		http.Error(w, "Can't decode config file", http.StatusInternalServerError)
		return
	}

	// CPU Usage per core
	cpuUsagePerCore, _ := cpu.Percent(0, true)
	// Average CPU usage
	cpuUsageAvg, _ := cpu.Percent(0, false)
	cpuUsageAvgRounded := math.Round(cpuUsageAvg[0]*10) / 10 // Rond af op één decimaal

	// CPU Frequencies
	cpuFrequencies, _ := cpu.Info()

	// Filter out the flags from the CPU frequencies
	var filteredCpuFrequencies []map[string]interface{}
	for _, freq := range cpuFrequencies {
		filteredFreq := map[string]interface{}{
			"cpu":        freq.CPU,
			"vendorId":   freq.VendorID,
			"family":     freq.Family,
			"model":      freq.Model,
			"stepping":   freq.Stepping,
			"physicalId": freq.PhysicalID,
			"coreId":     freq.CoreID,
			"cores":      freq.Cores,
			"modelName":  freq.ModelName,
			"mhz":        freq.Mhz,
			"cacheSize":  freq.CacheSize,
			"microcode":  freq.Microcode,
		}
		filteredCpuFrequencies = append(filteredCpuFrequencies, filteredFreq)
	}

	// Memory Usage
	vMem, _ := mem.VirtualMemory()
	totalMemoryGB := float64(vMem.Total) / (1024 * 1024 * 1024)
	usedMemoryGB := float64(vMem.Used) / (1024 * 1024 * 1024)

	// Disk Usage
	partitions, err := disk.Partitions(true)
	if err != nil {
		log.Printf("Failed to get disk partitions: %v", err)
		http.Error(w, "Failed to get disk partitions", http.StatusInternalServerError)
		return
	}

	var diskInfos []map[string]interface{}
	var logs []string
	mutex.Lock()
	defer mutex.Unlock()
	for _, partition := range partitions {
		logs = append(logs, fmt.Sprintf("Inspecting partition: %s, mountpoint: %s, fstype: %s", partition.Device, partition.Mountpoint, partition.Fstype))
		if partition.Fstype == "tmpfs" || partition.Fstype == "devtmpfs" || partition.Fstype == "overlay" || strings.HasPrefix(partition.Mountpoint, "/sys") || strings.HasPrefix(partition.Mountpoint, "/proc") || strings.HasPrefix(partition.Mountpoint, "/run") {
			// Skip pseudo or virtual filesystems
			logs = append(logs, fmt.Sprintf("Skipping pseudo or virtual filesystem: %s", partition.Mountpoint))
			continue
		}

		diskUsage, err := disk.Usage(partition.Mountpoint)
		if err != nil {
			logs = append(logs, fmt.Sprintf("Failed to get disk usage for %s: %v", partition.Mountpoint, err))
			continue
		}

		deviceName := strings.TrimPrefix(partition.Device, "/dev/")
		ioStats, err := disk.IOCounters(deviceName)
		if err != nil {
			logs = append(logs, fmt.Sprintf("Failed to get IO counters for %s: %v", deviceName, err))
			continue
		}

		for _, ioStat := range ioStats {
			previousStat, exists := previousDiskStats[partition.Device]
			if !exists {
				previousDiskStats[partition.Device] = ioStat
				continue
			}

			readSpeed := float64(ioStat.ReadBytes-previousStat.ReadBytes) / float64(config.UpdateIntervalSeconds)
			writeSpeed := float64(ioStat.WriteBytes-previousStat.WriteBytes) / float64(config.UpdateIntervalSeconds)

			previousDiskStats[partition.Device] = ioStat

			// Convert disk space to MB and filter out disks with less than 100MB free space
			freeSpaceMB := diskUsage.Free / (1024 * 1024)
			if freeSpaceMB < 100 {
				continue
			}

			diskInfo := map[string]interface{}{
				"device":       partition.Device,
				"mountpoint":   partition.Mountpoint,
				"fstype":       partition.Fstype,
				"total_space":  diskUsage.Total / (1024 * 1024), // Convert to MB
				"used_space":   diskUsage.Used / (1024 * 1024),  // Convert to MB
				"free_space":   freeSpaceMB,                     // Already in MB
				"read_bytes":   ioStat.ReadBytes,
				"write_bytes":  ioStat.WriteBytes,
				"read_count":   ioStat.ReadCount,
				"write_count":  ioStat.WriteCount,
				"read_time":    ioStat.ReadTime,
				"write_time":   ioStat.WriteTime,
				"read_speed":   readSpeed,
				"write_speed":  writeSpeed,
			}
			diskInfos = append(diskInfos, diskInfo)
			
		}
	}

	// Computer information
	hostInfo, _ := host.Info()

	// GPU Info
	gpuInfo, err := getGPUInfo()
	if err != nil {
		log.Printf("Error retrieving GPU info: %v\n", err)
		logs = append(logs, fmt.Sprintf("Error retrieving GPU info: %v", err))
	}

	// Uptime
	uptime, _ := host.Uptime()
	uptimeStr := formatUptime(uptime)

	// Thread Count
	threadCount := runtime.NumGoroutine()

	// CPU Temperature (dummy value, replace with actual retrieval if available)
	cpuTemperature := "N/A"

	// Prepare the data to be sent
	data := map[string]interface{}{
		"cpu_usage_per_core":      cpuUsagePerCore,
		"cpu_usage":               cpuUsageAvgRounded,
		"cpu_frequencies":         filteredCpuFrequencies, // Use filtered CPU frequencies
		"total_memory":            totalMemoryGB,
		"used_memory":             usedMemoryGB,
		"memory_usage":            vMem.UsedPercent,
		"disk_infos":              diskInfos, // Make sure this is always present
		"os":                      hostInfo.OS,
		"platform":                hostInfo.Platform,
		"platform_version":        hostInfo.PlatformVersion,
		"hostname":                hostInfo.Hostname,
		"gpu_info":                gpuInfo,
		"update_interval_seconds": config.UpdateIntervalSeconds, // Add update interval to the response
		"cpu_info": map[string]interface{}{
			"name":        cpuFrequencies[0].ModelName,
			"temperature": cpuTemperature,
			"frequency":   cpuFrequencies[0].Mhz,
			"cores":       runtime.NumCPU(),
			"uptime":      uptimeStr,
			"threads":     threadCount,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

// Function to save historical data to a file
func saveHistoricalDataToFile() error {
	file, err := os.Create("json/historical_data.json")
	if err != nil {
		return err
	}
	defer file.Close()

	encoder := json.NewEncoder(file)
	if err := encoder.Encode(historicalData); err != nil {
		return err
	}

	return nil
}

func formatUptime(seconds uint64) string {
	days := seconds / 86400
	hours := (seconds % 86400) / 3600
	minutes := (seconds % 3600) / 60
	return fmt.Sprintf("%dd %dh %dm", days, hours, minutes)
}

func getGPUInfo() (map[string]interface{}, error) {
	gpuInfo := make(map[string]interface{})

	nvidiaInfo, err := getNvidiaGPUInfo()
	if err == nil {
		for k, v := range nvidiaInfo {
			gpuInfo[k] = v
		}
	} else {
		log.Printf("Failed to get NVIDIA GPU info: %v\n", err)
	}

	amdInfo, err := getAmdGPUInfo()
	if err == nil {
		for k, v := range amdInfo {
			gpuInfo[k] = v
		}
	} else {
		log.Printf("Failed to get AMD GPU info: %v\n", err)
	}

	// Als er geen GPU-informatie is gevonden, vul deze met nulwaarden
	if len(gpuInfo) == 0 {
		gpuInfo["gpu0"] = map[string]interface{}{
			"name":                "N/A",
			"uuid":                "N/A",
			"temperature_gpu":     "N/A",
			"utilization_gpu":     "N/A",
			"utilization_mem":     "N/A",
			"memory_total":        "N/A",
			"memory_used":         "N/A",
			"memory_free":         "N/A",
			"encoder_utilization": "N/A",
			"decoder_utilization": "N/A",
			"fan_speed":           "N/A",
			"clock_speed":         "N/A",
			"memory_clock_speed":  "N/A",
		}
	}

	return gpuInfo, nil
}

func getNvidiaGPUInfo() (map[string]interface{}, error) {
	err := nvml.Initialize()
	if err != nil {
		return nil, fmt.Errorf("Failed to initialize NVML: %v", err)
	}
	defer nvml.Shutdown()

	deviceCount, err := nvml.DeviceCount()
	if err != nil {
		return nil, fmt.Errorf("Failed to get device count: %v", err)
	}

	gpuInfo := make(map[string]interface{})

	for i := uint(0); i < deviceCount; i++ {
		device, err := nvml.DeviceHandleByIndex(i)
		if err != nil {
			log.Printf("Failed to get device handle for GPU %d: %v", i, err)
			continue
		}

		name, err := device.Name()
		if err != nil {
			log.Printf("Failed to get device name for GPU %d: %v", i, err)
			continue
		}

		uuid, err := device.UUID()
		if err != nil {
			log.Printf("Failed to get device UUID for GPU %d: %v", i, err)
			continue
		}

		temperature, err := device.Temperature()
		if err != nil {
			log.Printf("Failed to get device temperature for GPU %d: %v", i, err)
			continue
		}

		utilization, _, err := device.UtilizationRates()
		if err != nil {
			log.Printf("Failed to get device utilization rates for GPU %d: %v", i, err)
			continue
		}

		totalMemory, usedMemory, err := device.MemoryInfo()
		if err != nil {
			log.Printf("Failed to get device memory info for GPU %d: %v", i, err)
			continue
		}
		freeMemory := totalMemory - usedMemory

		encoderUtilization := uint(0)
		if encUtil, _, err := device.EncoderUtilization(); err == nil {
			encoderUtilization = encUtil
		} else {
			log.Printf("Failed to get encoder utilization for GPU %d: %v", i, err)
		}

		decoderUtilization := uint(0)
		if decUtil, _, err := device.DecoderUtilization(); err == nil {
			decoderUtilization = decUtil
		} else {
			log.Printf("Failed to get decoder utilization for GPU %d: %v", i, err)
		}

		fanSpeed := uint(0)
		if fanSpeedVal, err := device.FanSpeed(); err == nil {
			fanSpeed = fanSpeedVal
		} else {
			log.Printf("Failed to get fan speed for GPU %d: %v", i, err)
		}

		clockSpeed, memoryClockSpeed := getClockSpeeds()

		gpu := map[string]interface{}{
			"name":                name,
			"uuid":                uuid,
			"temperature_gpu":     temperature,
			"utilization_gpu":     utilization,
			"utilization_mem":     float64(usedMemory) / float64(totalMemory) * 100,
			"memory_total":        totalMemory / 1024 / 1024, // Convert to MB
			"memory_used":         usedMemory / 1024 / 1024,  // Convert to MB
			"memory_free":         freeMemory / 1024 / 1024,  // Convert to MB
			"encoder_utilization": encoderUtilization,
			"decoder_utilization": decoderUtilization,
			"fan_speed":           fanSpeed,
			"clock_speed":         clockSpeed,       // in MHz
			"memory_clock_speed":  memoryClockSpeed, // in MHz
		}

		gpuInfo[fmt.Sprintf("gpu%d", i)] = gpu
	}

	// Als er geen GPU-informatie is gevonden, vul deze met nulwaarden
	if len(gpuInfo) == 0 {
		gpuInfo["gpu0"] = map[string]interface{}{
			"name":                "N/A",
			"uuid":                "N/A",
			"temperature_gpu":     "N/A",
			"utilization_gpu":     "N/A",
			"utilization_mem":     "N/A",
			"memory_total":        "N/A",
			"memory_used":         "N/A",
			"memory_free":         "N/A",
			"encoder_utilization": "N/A",
			"decoder_utilization": "N/A",
			"fan_speed":           "N/A",
			"clock_speed":         "N/A",
			"memory_clock_speed":  "N/A",
		}
	}

	return gpuInfo, nil
}

func getClockSpeeds() (clockSpeed int, memoryClockSpeed int) {
	clockSpeed = 0
	memoryClockSpeed = 0

	cmd := exec.Command("nvidia-smi", "--query-gpu=clocks.gr,clocks.mem", "--format=csv,noheader,nounits")
	output, err := cmd.Output()
	if err != nil {
		log.Printf("Failed to execute nvidia-smi: %v\n", err)
		return
	}

	lines := strings.Split(string(output), "\n")
	if len(lines) > 0 {
		parts := strings.Split(lines[0], ",")
		if len(parts) == 2 {
			fmt.Sscanf(strings.TrimSpace(parts[0]), "%d", &clockSpeed)
			fmt.Sscanf(strings.TrimSpace(parts[1]), "%d", &memoryClockSpeed)
		}
	}

	return
}

func getAmdGPUInfo() (map[string]interface{}, error) {
	cmd := exec.Command("rocm-smi", "--showallinfo")
	output, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("Failed to run rocm-smi: %v", err)
	}

	lines := strings.Split(string(output), "\n")
	gpuInfo := make(map[string]interface{})
	for i, line := range lines {
		gpuInfo[fmt.Sprintf("amd_gpu%d_info%d", i, i)] = line
	}

	return gpuInfo, nil
}

func checkErr(err error) {
	if err != nil {
		fmt.Fprintf(os.Stderr, "Fatal error: %s\n", err.Error())
		os.Exit(1)
	}
}
