package main

import (
    "encoding/json"
    "fmt"
    "io/ioutil"
    "log"
    "math"
    "net/http"
    "os"
    "os/exec"
    "path/filepath"
    "runtime"
    "strings"
    "time"

    "github.com/shirou/gopsutil/cpu"
    "github.com/shirou/gopsutil/disk"
    "github.com/shirou/gopsutil/host"
    "github.com/shirou/gopsutil/mem"
    nvml "github.com/mindprince/gonvml"
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

var historicalData HistoricalData // Declare a global variable to store historical data

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

    // Start a goroutine to collect and store historical data periodically
    go saveHistoricalDataPeriodically(config)

    // Register endpoint handlers
    http.HandleFunc("/save_historical_data", saveHistoricalData)
    http.HandleFunc("/history", serveHistoricalData)

    startTrayIcon()

    // Web server
    websiteDir := filepath.Join(".", "Website")
    fs := http.FileServer(http.Dir(websiteDir))
    http.Handle("/", fs)

    // Sends json to /system_info
    http.HandleFunc("/system_info", systemInfoHandler)

    fmt.Printf("Server started at http://localhost:%d\n", config.ServerPort)
    http.ListenAndServe(fmt.Sprintf(":%d", config.ServerPort), nil)
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
    // Get the config file
    configFile, err := os.Open("json/config.json")
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
    // CPU Usage
    cpuUsage, _ := cpu.Percent(0, false)
    cpuUsageX10 := cpuUsage[0] * 2
    roundedCPUUsage := fmt.Sprintf("%.0f", cpuUsageX10)

    // Memory Usage
    vMem, _ := mem.VirtualMemory()
    totalMemoryGB := float64(vMem.Total) / (1024 * 1024 * 1024)
    usedMemoryGB := float64(vMem.Used) / (1024 * 1024 * 1024)

    // Disk Usage
    diskUsage, _ := disk.Usage("/")
    availableDiskSpaceGB := float64(diskUsage.Total-diskUsage.Used) / float64(1<<30)
    totalDiskSpaceGB := math.Round(float64(diskUsage.Total) / float64(1<<30))
    usedDiskSpaceGB := math.Round(float64(diskUsage.Used) / float64(1<<30))
    availableDiskSpaceGB = math.Round(availableDiskSpaceGB)

    // Computer information
    hostInfo, _ := host.Info()

    // GPU Info
    gpuInfo, err := getGPUInfo()
    if err != nil {
        fmt.Printf("Error retrieving GPU info: %v\n", err)
    }

    // Send data as JSON
    data := map[string]interface{}{
        "cpu_usage":               roundedCPUUsage,
        "total_memory":            totalMemoryGB,
        "used_memory":             usedMemoryGB,
        "memory_usage":            vMem.UsedPercent,
        "total_disk_space_gb":     totalDiskSpaceGB,
        "used_disk_space_gb":      usedDiskSpaceGB,
        "available_disk_space_gb": availableDiskSpaceGB,
        "disk_usage_percent":      diskUsage.UsedPercent,
        "os":                      hostInfo.OS,
        "platform":                hostInfo.Platform,
        "platform_version":        hostInfo.PlatformVersion,
        "hostname":                hostInfo.Hostname,
        "gpu_info":                gpuInfo,
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(data)

    // wait for the interval in config.json
    time.Sleep(time.Duration(config.UpdateIntervalSeconds) * time.Second)
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

    integratedInfo, err := getIntegratedGPUInfo()
    if err == nil {
        for k, v := range integratedInfo {
            gpuInfo[k] = v
        }
    } else {
        log.Printf("Failed to get integrated GPU info: %v\n", err)
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
            return nil, fmt.Errorf("Failed to get device handle: %v", err)
        }

        name, err := device.Name()
        if err != nil {
            return nil, fmt.Errorf("Failed to get device name: %v", err)
        }

        uuid, err := device.UUID()
        if err != nil {
            return nil, fmt.Errorf("Failed to get device UUID: %v", err)
        }

        temperature, err := device.Temperature()
        if err != nil {
            return nil, fmt.Errorf("Failed to get device temperature: %v", err)
        }

        utilization, _, err := device.UtilizationRates()
        if err != nil {
            return nil, fmt.Errorf("Failed to get device utilization rates: %v", err)
        }

        totalMemory, usedMemory, err := device.MemoryInfo()
        if err != nil {
            return nil, fmt.Errorf("Failed to get device memory info: %v", err)
        }
        freeMemory := totalMemory - usedMemory

        encoderUtilization := uint(0)
        if encUtil, _, err := device.EncoderUtilization(); err == nil {
            encoderUtilization = encUtil
        } else {
            log.Printf("Failed to get encoder utilization: %v\n", err)
        }

        decoderUtilization := uint(0)
        if decUtil, _, err := device.DecoderUtilization(); err == nil {
            decoderUtilization = decUtil
        } else {
            log.Printf("Failed to get decoder utilization: %v\n", err)
        }

        fanSpeed := uint(0)
        if fanSpeedVal, err := device.FanSpeed(); err == nil {
            fanSpeed = fanSpeedVal
        } else {
            log.Printf("Failed to get fan speed: %v\n", err)
        }

      

        clockSpeed, memoryClockSpeed := getClockSpeeds()

        gpu := map[string]interface{}{
            "name":                 name,
            "uuid":                 uuid,
            "temperature_gpu":      temperature,
            "utilization_gpu":      utilization,
            "utilization_mem":      float64(usedMemory) / float64(totalMemory) * 100,
            "memory_total":         totalMemory / 1024 / 1024, // Convert to MB
            "memory_used":          usedMemory / 1024 / 1024,  // Convert to MB
            "memory_free":          freeMemory / 1024 / 1024,  // Convert to MB
            "encoder_utilization":  encoderUtilization,
            "decoder_utilization":  decoderUtilization,
            "fan_speed":            fanSpeed,
            "clock_speed":          clockSpeed, // in MHz
            "memory_clock_speed":   memoryClockSpeed, // in MHz
        }

        gpuInfo[fmt.Sprintf("gpu%d", i)] = gpu
    }

    return gpuInfo, nil
}


func getClockSpeeds() (clockSpeed int, memoryClockSpeed int) {
    clockSpeed = -1
    memoryClockSpeed = -1

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

func getIntegratedGPUInfo() (map[string]interface{}, error) {
    drmPath := "/sys/class/drm/card0/device/"
    tempPath := drmPath + "hwmon/hwmon0/temp1_input"
    utilPath := drmPath + "gpu_busy_percent"

    temperature, err := ioutil.ReadFile(tempPath)
    if err != nil {
        return nil, fmt.Errorf("Failed to read temperature: %v", err)
    }

    utilization, err := ioutil.ReadFile(utilPath)
    if err != nil {
        return nil, fmt.Errorf("Failed to read utilization: %v", err)
    }

    temp := strings.TrimSpace(string(temperature))
    util := strings.TrimSpace(string(utilization))

    gpuInfo := map[string]interface{}{
        "temperature":    temp,
        "gpu_utilization": util,
    }

    return gpuInfo, nil
}

func checkErr(err error) {
    if err != nil {
        fmt.Fprintf(os.Stderr, "Fatal error: %s\n", err.Error())
        os.Exit(1)
    }
}
