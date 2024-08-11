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

    "github.com/gorilla/websocket"
    "github.com/shirou/gopsutil/cpu"
    "github.com/shirou/gopsutil/disk"
    "github.com/shirou/gopsutil/host"
    "github.com/shirou/gopsutil/mem"
    "github.com/shirou/gopsutil/process"
)

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
    } `json:"historical_data"`
}

type Computer struct {
    Name string `json:"name"`
    IP   string `json:"ip"`
    Port int    `json:"port"`
}

type ComputersConfig struct {
    Computers []Computer `json:"computers"`
}

var (
    historicalData      HistoricalData           // Declare a global variable to store historical data
    previousDiskStats   map[string]disk.IOCountersStat // Store previous disk stats for calculating speeds
    mutex               sync.Mutex                     // Ensure thread safety
    upgrader            = websocket.Upgrader{
        CheckOrigin: func(r *http.Request) bool {
            return true
        },
    }
)

func removeHistoricalDataFile() {
    err := os.Remove("json/historical_data.json")
    if err != nil && !os.IsNotExist(err) {
        log.Printf("Failed to remove historical data file: %v\n", err)
    }
}

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

func filterSystemInfo(data map[string]interface{}) map[string]interface{} {
    // Filter cpu_frequencies: Remove the 'family' field
    if cpuFrequencies, ok := data["cpu_frequencies"].([]map[string]interface{}); ok {
        for i := range cpuFrequencies {
            delete(cpuFrequencies[i], "family")
        }
    }

    // Filter running_apps: Remove 'swap' from memory_info
    if runningApps, ok := data["running_apps"].([]map[string]interface{}); ok {
        for _, app := range runningApps {
            if memoryInfo, ok := app["memory_info"].(*process.MemoryInfoStat); ok {
                memoryInfo.Swap = 0
            }
        }
    }

    return data
}

func saveHistoricalData(w http.ResponseWriter, r *http.Request) {
    var newData HistoricalData
    err := json.NewDecoder(r.Body).Decode(&newData)
    if err != nil {
        http.Error(w, "Failed to decode JSON", http.StatusBadRequest)
        return
    }

    historicalData = newData

    if err := saveHistoricalDataToFile(); err != nil {
        http.Error(w, "Failed to save historical data to file", http.StatusInternalServerError)
        return
    }

    w.WriteHeader(http.StatusOK)
}

func serveHistoricalData(w http.ResponseWriter, r *http.Request) {
    if err := loadHistoricalDataFromFile(); err != nil {
        http.Error(w, "Failed to load historical data from file", http.StatusInternalServerError)
        return
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(historicalData)
}

func main() {
    removeHistoricalDataFile()

    configFile, err := os.Open("json/config.json")
    if err != nil {
        fmt.Println("Can't open config file:", err)
        return
    }
    defer configFile.Close()
    var config Config

    err = json.NewDecoder(configFile).Decode(&config)
    if err != nil {
        fmt.Println("Can't decode config file:", err)
        return
    }

    previousDiskStats = make(map[string]disk.IOCountersStat)

    go saveHistoricalDataPeriodically(config)

    mux := http.NewServeMux()

    mux.HandleFunc("/save_historical_data", saveHistoricalData)
    mux.HandleFunc("/history", serveHistoricalData)
    mux.HandleFunc("/system_info", systemInfoHandler)
    mux.HandleFunc("/system_info_all", systemInfoHandlerAll)
    mux.HandleFunc("/ws", systemInfoWebSocketHandler)

    websiteDir := filepath.Join(".", "Website")
    fs := http.FileServer(http.Dir(websiteDir))
    mux.Handle("/", fs)
    mux.Handle("/cpu", http.FileServer(http.Dir(filepath.Join(websiteDir, "cpu.html"))))

    fmt.Printf("Server started at http://localhost:%d\n", config.ServerPort)
    err = http.ListenAndServe(fmt.Sprintf(":%d", config.ServerPort), mux)
    if err != nil {
        log.Fatalf("Failed to start server: %v", err)
    }
}

func saveHistoricalDataPeriodically(config Config) {
    ticker := time.NewTicker(time.Duration(config.TickerIntervalSeconds) * time.Second)
    defer ticker.Stop()

    for {
        <-ticker.C

        cpuUsage, _ := cpu.Percent(0, false)
        memoryUsage, _ := mem.VirtualMemory()

        timestamp := time.Now().Format("01/02/2006 15:04:05")

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

        if err := saveHistoricalDataToFile(); err != nil {
            log.Printf("Failed to save historical data: %v\n", err)
            continue
        }
    }
}

func systemInfoHandler(w http.ResponseWriter, r *http.Request) {
    data := getSystemInfoData()
    filteredData := filterSystemInfo(data)

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(filteredData)
}

func getSystemInfoData() map[string]interface{} {
    // Implement your logic to fetch system info data, similar to what you did in systemInfoHandler
    // This is where you can combine various pieces of information into the final structure.
    
    // For example, fetch CPU, memory, disk, and other system stats
    cpuUsagePerCore, _ := cpu.Percent(0, true)
    cpuUsageAvg, _ := cpu.Percent(0, false)
    cpuUsageAvgRounded := math.Round(cpuUsageAvg[0]*10) / 10

    cpuFrequencies, _ := cpu.Info()
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

    vMem, _ := mem.VirtualMemory()
    totalMemoryGB := float64(vMem.Total) / (1024 * 1024 * 1024)
    usedMemoryGB := float64(vMem.Used) / (1024 * 1024 * 1024)

    hostInfo, _ := host.Info()
    gpuInfo, _ := getNvidiaGPUInfo()
    uptime, _ := host.Uptime()
    uptimeStr := formatUptime(uptime)
    threadCount := runtime.NumGoroutine()

    data := map[string]interface{}{
        "cpu_usage_per_core": cpuUsagePerCore,
        "cpu_usage":          cpuUsageAvgRounded,
        "cpu_frequencies":    filteredCpuFrequencies,
        "total_memory":       totalMemoryGB,
        "used_memory":        usedMemoryGB,
        "memory_usage":       vMem.UsedPercent,
        "os":                 hostInfo.OS,
        "platform":           hostInfo.Platform,
        "platform_version":   hostInfo.PlatformVersion,
        "hostname":           hostInfo.Hostname,
        "gpu_info":           gpuInfo,
        "cpu_info": map[string]interface{}{
            "name":         cpuFrequencies[0].ModelName,
            "frequency":    cpuFrequencies[0].Mhz,
            "cores":        runtime.NumCPU(),
            "uptime":       uptimeStr,
            "threads":      threadCount,
        },
    }

    return data
}

func systemInfoHandlerAll(w http.ResponseWriter, r *http.Request) {
    computersConfig, err := loadComputersConfig()
    if err != nil {
        http.Error(w, "Can't load computers config file", http.StatusInternalServerError)
        return
    }

    allSystemInfo := make(map[string]interface{})

    for _, computer := range computersConfig.Computers {
        if computer.Name == "Local" {
            localData := getSystemInfoData()
            filteredData := filterSystemInfo(localData)
            allSystemInfo[fmt.Sprintf("system_info_%s", computer.Name)] = filteredData
        } else {
            remoteInfo, err := fetchRemoteSystemInfo(computer.IP, computer.Port)
            if err != nil {
                log.Printf("Failed to fetch system info for %s: %v", computer.Name, err)
                continue
            }

            // Apply filtering to the remote system info
            filteredInfo := filterSystemInfo(remoteInfo)
            allSystemInfo[fmt.Sprintf("system_info_%s", computer.Name)] = filteredInfo
        }
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(allSystemInfo)
}
func systemInfoWebSocketHandler(w http.ResponseWriter, r *http.Request) {
    conn, err := upgrader.Upgrade(w, r, nil)
    if err != nil {
        log.Println("Failed to upgrade to WebSocket:", err)
        return
    }
    defer conn.Close()

    log.Printf("WebSocket connection established from %s", r.RemoteAddr)

    for {
        data := getSystemInfoData()
        filteredData := filterSystemInfo(data)

        // Attempt to send data over WebSocket
        err := conn.WriteJSON(filteredData)
        if err != nil {
            log.Printf("Error sending data to %s over WebSocket: %v", r.RemoteAddr, err)
            break // Exit loop on error to prevent "broken pipe" issues
        }

        log.Printf("Data sent successfully to %s", r.RemoteAddr)

        time.Sleep(time.Second) // Send updates every second
    }

    log.Printf("WebSocket connection closed gracefully from %s", r.RemoteAddr)
}



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

func getNvidiaGPUInfo() (map[string]interface{}, error) {
    cmd := exec.Command("nvidia-smi", "--query-gpu=name,uuid,temperature.gpu,utilization.gpu,memory.total,memory.used,memory.free,fan.speed,clocks.gr,clocks.mem,utilization.encoder,utilization.decoder", "--format=csv,noheader,nounits")
    output, err := cmd.Output()
    if err != nil {
        return map[string]interface{}{
            "gpu0": map[string]interface{}{
                "name":                "N/A",
                "uuid":                "N/A",
                "temperature_gpu":     "N/A",
                "utilization_gpu":     "N/A",
                "memory_total":        "N/A",
                "memory_used":         "N/A",
                "memory_free":         "N/A",
                "fan_speed":           "N/A",
                "clock_speed":         "N/A",
                "memory_clock_speed":  "N/A",
                "encoder_utilization": "N/A",
                "decoder_utilization": "N/A",
            },
        }, nil
    }

    lines := strings.Split(string(output), "\n")
    gpuInfo := make(map[string]interface{})
    for i, line := range lines {
        if line == "" {
            continue
        }
        fields := strings.Split(line, ",")
        if len(fields) != 12 {
            continue
        }
        gpu := map[string]interface{}{
            "name":                strings.TrimSpace(fields[0]),
            "uuid":                strings.TrimSpace(fields[1]),
            "temperature_gpu":     strings.TrimSpace(fields[2]),
            "utilization_gpu":     strings.TrimSpace(fields[3]),
            "memory_total":        strings.TrimSpace(fields[4]),
            "memory_used":         strings.TrimSpace(fields[5]),
            "memory_free":         strings.TrimSpace(fields[6]),
            "fan_speed":           strings.TrimSpace(fields[7]),
            "clock_speed":         strings.TrimSpace(fields[8]),
            "memory_clock_speed":  strings.TrimSpace(fields[9]),
            "encoder_utilization": strings.TrimSpace(fields[10]),
            "decoder_utilization": strings.TrimSpace(fields[11]),
        }
        gpuInfo[fmt.Sprintf("gpu%d", i)] = gpu
    }
    if len(gpuInfo) == 0 {
        gpuInfo["gpu0"] = map[string]interface{}{
            "name":                "N/A",
            "uuid":                "N/A",
            "temperature_gpu":     "N/A",
            "utilization_gpu":     "N/A",
            "memory_total":        "N/A",
            "memory_used":         "N/A",
            "memory_free":         "N/A",
            "fan_speed":           "N/A",
            "clock_speed":         "N/A",
            "memory_clock_speed":  "N/A",
            "encoder_utilization": "N/A",
            "decoder_utilization": "N/A",
        }
    }
    return gpuInfo, nil
}

func loadComputersConfig() (ComputersConfig, error) {
    var computersConfig ComputersConfig
    configFile, err := os.Open("Website/computers.json")
    if err != nil {
        return computersConfig, err
    }
    defer configFile.Close()

    err = json.NewDecoder(configFile).Decode(&computersConfig)
    if err != nil {
        return computersConfig, err
    }

    return computersConfig, nil
}

func fetchRemoteSystemInfo(ip string, port int) (map[string]interface{}, error) {
    url := fmt.Sprintf("http://%s:%d/system_info", ip, port)
    resp, err := http.Get(url)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    var data map[string]interface{}
    err = json.NewDecoder(resp.Body).Decode(&data)
    if err != nil {
        return nil, err
    }

    return data, nil
}
