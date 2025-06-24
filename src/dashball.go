package main
//go:generate go run github.com/tc-hib/go-winres simply

import (
    "encoding/json"
    "fmt"
    "log"
    "math"
    "net/http"
    "os"   
    "path/filepath"
    "runtime"
    "strings"
    "strconv"
    "sync"
    "time"

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
    historicalData      HistoricalData
    previousDiskStats   map[string]disk.IOCountersStat
    mutex               sync.Mutex
    historicalDataPath  string
)

func removeHistoricalDataFile() {
    err := os.Remove(historicalDataPath)
    if err != nil && !os.IsNotExist(err) {
        log.Printf("Failed to remove historical data file: %v\n", err)
    }
}

func loadHistoricalDataFromFile() error {
    file, err := os.Open(historicalDataPath)
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
    historicalDataPath = filepath.Join(os.TempDir(), "historical_data.json")

    removeHistoricalDataFile()

    configFile, err := os.Open("Website/dashball.cfg")
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
    data, err := fetchSystemInfo()
    if err != nil {
        http.Error(w, "Failed to fetch system info", http.StatusInternalServerError)
        return
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(data)
}


func fetchSystemInfo() (map[string]interface{}, error) {
    configFile, err := os.Open("Website/dashball.cfg")
    if err != nil {
        return nil, err
    }
    defer configFile.Close()

    var config Config
    err = json.NewDecoder(configFile).Decode(&config)
    if err != nil {
        return nil, err
    }

    cpuUsagePerCore, _ := cpu.Percent(0, true)
    cpuUsageAvg, _ := cpu.Percent(0, false)
    cpuUsageAvgRounded := math.Round(cpuUsageAvg[0]*10) / 10
    cpuFrequencies, _ := cpu.Info()
    var filteredCpuFrequencies []map[string]interface{}
    for _, freq := range cpuFrequencies {
        filteredFreq := map[string]interface{}{
            "cpu":        freq.CPU,
            "vendorId":   freq.VendorID,
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

    partitions, err := disk.Partitions(true)
    if err != nil {
        log.Printf("Failed to get disk partitions: %v", err)
        return nil, err
    }

    var diskInfos []map[string]interface{}
    var logs []string
    mutex.Lock()
    defer mutex.Unlock()
    for _, partition := range partitions {
        logs = append(logs, fmt.Sprintf("Inspecting partition: %s, mountpoint: %s, fstype: %s", partition.Device, partition.Mountpoint, partition.Fstype))
        if partition.Fstype == "tmpfs" || partition.Fstype == "devtmpfs" || partition.Fstype == "overlay" || strings.HasPrefix(partition.Mountpoint, "/sys") || strings.HasPrefix(partition.Mountpoint, "/proc") || strings.HasPrefix(partition.Mountpoint, "/run") {
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

            freeSpaceMB := diskUsage.Free / (1024 * 1024)
            if freeSpaceMB < 100 {
                continue
            }

            diskInfo := map[string]interface{}{
                "device":       partition.Device,
                "mountpoint":   partition.Mountpoint,
                "fstype":       partition.Fstype,
                "total_space":  diskUsage.Total / (1024 * 1024),
                "used_space":   diskUsage.Used / (1024 * 1024),
                "free_space":   freeSpaceMB,
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

    hostInfo, _ := host.Info()
    gpuInfo, _ := getNvidiaGPUInfo()
    uptime, _ := host.Uptime()
    uptimeStr := formatUptime(uptime)
    threadCount := runtime.NumGoroutine()
    cpuTemperature := "N/A"


    data := map[string]interface{}{
        "cpu_usage_per_core":      cpuUsagePerCore,
        "cpu_usage":               cpuUsageAvgRounded,
        "cpu_frequencies":         filteredCpuFrequencies,
        "total_memory":            totalMemoryGB,
        "used_memory":             usedMemoryGB,
        "memory_usage":            vMem.UsedPercent,
        "disk_infos":              diskInfos,
        "os":                      hostInfo.OS,
        "platform":                hostInfo.Platform,
        "platform_version":        hostInfo.PlatformVersion,
        "hostname":                hostInfo.Hostname,
        "gpu_info":                gpuInfo,
        "update_interval_seconds": config.UpdateIntervalSeconds,
        "cpu_info": map[string]interface{}{
            "name":         cpuFrequencies[0].ModelName,
            "temperature":  cpuTemperature,
            "frequency":    cpuFrequencies[0].Mhz,
            "cores":        runtime.NumCPU(),
            "uptime":       uptimeStr,
            "threads":      threadCount,
        },
    }
    configFile2, err := os.Open("Website/dashball.cfg")
    var runningApps []map[string]interface{} 
    showApps := false
    if err == nil {
        defer configFile2.Close()
        var cfg struct {
            NavbarPages map[string]bool `json:"navbar_pages"`
        }
        if err := json.NewDecoder(configFile2).Decode(&cfg); err == nil {
            showApps = cfg.NavbarPages["applications.html"]
        }
    }
    if showApps {
        gpuProcessUsage := getProcessGPUUsage()
        gpuProcessMemory := getProcessGPUMemoryUsage()
        processes, err := process.Processes()
        if err == nil {
            processMap := make(map[string]map[string]interface{})
            for _, p := range processes {
                name, err := p.Name()
                if err != nil {
                    continue
                }
                exe, _ := p.Exe()
                cpuPercent, err := p.CPUPercent()
                if err != nil || cpuPercent == 0.0 {
                    continue
                }
                memInfo, err := p.MemoryInfo()
                if err != nil {
                    memInfo = &process.MemoryInfoStat{}
                }
                ioCounters, err := p.IOCounters()
                if err != nil {
                    ioCounters = &process.IOCountersStat{}
                }
                pid := p.Pid
                gpuPercent := 0
                gpuMem := 0
                if val, ok := gpuProcessUsage[int(pid)]; ok {
                    gpuPercent = val
                }
                if val, ok := gpuProcessMemory[int(pid)]; ok {
                    gpuMem = val
                }
                if app, exists := processMap[name]; exists {
                    count := app["process_count"].(int) + 1
                    app["cpu_percent"] = (app["cpu_percent"].(float64)*float64(count-1) + cpuPercent) / float64(count)
                    app["memory_info"].(*process.MemoryInfoStat).RSS += memInfo.RSS
                    app["read_bytes"] = app["read_bytes"].(uint64) + ioCounters.ReadBytes
                    app["write_bytes"] = app["write_bytes"].(uint64) + ioCounters.WriteBytes
                    app["gpu_percent"] = (app["gpu_percent"].(int)*(count-1) + gpuPercent) / count
                    app["gpu_memory_mb"] = app["gpu_memory_mb"].(int) + gpuMem
                } else {
                    processMap[name] = map[string]interface{}{
                        "name":        name,
                        "exe":         exe,
                        "cpu_percent": cpuPercent,
                        "gpu_percent": gpuPercent,
                        "gpu_memory_mb": gpuMem,
                        "memory_info": memInfo,
                        "read_bytes":  ioCounters.ReadBytes,
                        "write_bytes": ioCounters.WriteBytes,
                        "pid":         pid,
                        "process_count": 1,
                    }
                }
            }
            for _, app := range processMap {
                runningApps = append(runningApps, app)
            }
        }
        if len(runningApps) > 0 {
            data["running_apps"] = runningApps
        }
    } else {
        if _, ok := data["running_apps"]; ok {
            delete(data, "running_apps")
        }
    }

    // Apply filtering before returning the data
    return filterSystemInfo(data), nil
}

func systemInfoHandlerAll(w http.ResponseWriter, r *http.Request) {
    computersConfig, err := loadComputersConfig()
    if err != nil {
        http.Error(w, "Can't load computers config file", http.StatusInternalServerError)
        return
    }

    allSystemInfo := make(map[string]interface{})

    for _, computer := range computersConfig.Computers {
        remoteInfo, err := fetchRemoteSystemInfo(computer.IP, computer.Port)
        if err != nil {
            log.Printf("Failed to fetch system info for %s: %v", computer.Name, err)
            continue
        }

        // Apply filtering to the remote system info
        filteredInfo := filterSystemInfo(remoteInfo)

        allSystemInfo[fmt.Sprintf("system_info_%s", computer.Name)] = filteredInfo
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(allSystemInfo)
}

func saveHistoricalDataToFile() error {
    file, err := os.Create(historicalDataPath)
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


func parseNvidiaSmiOutput(output []byte, err error) (map[string]interface{}, error) {
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

func parseNvidiaSmiPmonOutput(output []byte, err error) map[int]int {
    if err != nil {
        return map[int]int{}
    }
    usage := make(map[int]int)
    lines := strings.Split(string(output), "\n")
    for _, line := range lines {
        line = strings.TrimSpace(line)
        if line == "" || strings.HasPrefix(line, "#") {
            continue
        }
        fields := strings.Fields(line)
        if len(fields) < 5 {
            continue
        }
        pid, err := strconv.Atoi(fields[1])
        if err != nil {
            continue
        }
        sm, err := strconv.Atoi(fields[3])
        if err != nil {
            continue
        }
        usage[pid] = sm
    }
    return usage
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
