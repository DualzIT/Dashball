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
    "strings"
    "syscall"
    "time"
    "runtime"

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
        cmd := exec.Command("powershell.exe", "-File", "Trayicon\trayicon.ps1")
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
    // Start a goroutine to collect and store historical data periodically
    go saveHistoricalDataPeriodically()

    // Register endpoint handlers
    http.HandleFunc("/save_historical_data", saveHistoricalData)
    http.HandleFunc("/history", serveHistoricalData)

    startTrayIcon()

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
func saveHistoricalDataPeriodically() {
    ticker := time.NewTicker(10 * time.Second) // Ticker to collect data every 10 seconds
    defer ticker.Stop()

    for {
        <-ticker.C // Wait for the ticker to tick (every 10 seconds)

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

        log.Println("Historical data saved successfully")
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
    gpuInfo, _ := getGPUInfo()

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
    cmd := exec.Command("nvidia-smi", "--query-gpu=uuid,name,temperature.gpu,utilization.gpu,utilization.memory,memory.total,memory.used,memory.free", "--format=csv,noheader,nounits")

    if runtime.GOOS == "windows" {
        cmd.SysProcAttr = &syscall.SysProcAttr{
            
        }
    }

    output, err := cmd.CombinedOutput()

    if err != nil {
        // If there is no gpu found it will display null
        return map[string]interface{}{
            "gpu0": map[string]interface{}{
                "uuid":            "null",
                "name":            "null",
                "temperature_gpu": "null",
                "utilization_gpu": "null",
                "utilization_mem": "null",
                "memory_total":    "null",
                "memory_used":     "null",
                "memory_free":     "null",
            },
        }, nil
    }

    gpuInfo := make(map[string]interface{})

    lines := strings.Split(strings.TrimSpace(string(output)), "\n")
    for i, line := range lines {
        fields := strings.Split(line, ",")
        gpu := map[string]interface{}{
            "uuid":            fields[0],
            "name":            fields[1],
            "temperature_gpu": fields[2],
            "utilization_gpu": fields[3],
            "utilization_mem": fields[4],
            "memory_total":    fields[5],
            "memory_used":     fields[6],
            "memory_free":     fields[7],
        }
        gpuInfo[fmt.Sprintf("gpu%d", i)] = gpu
    }

    return gpuInfo, nil
}

func checkErr(err error) {
    if err != nil {
        fmt.Fprintf(os.Stderr, "Fatal error: %s\n", err.Error())
        os.Exit(1)
    }
}
