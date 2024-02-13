// go build -ldflags -H=windowsgui dashball.go
package main
import (
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall" 
	"time"

	"github.com/shirou/gopsutil/cpu"
	"github.com/shirou/gopsutil/disk"
	"github.com/shirou/gopsutil/host"
	"github.com/shirou/gopsutil/mem"
)
type Config struct {
	ServerPort            int `json:"port"`
	UpdateIntervalSeconds int `json:"update_interval_seconds"`
}

func main() {
	// Get the config file
	configFile, err := os.Open("config.json")
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
	// Webserver
	websiteDir := filepath.Join(".", "Website")
	fs := http.FileServer(http.Dir(websiteDir))
	http.Handle("/", fs)
	// Sends json to /system_info
	http.HandleFunc("/system_info", systemInfoHandler)
	fmt.Printf("Server gestart op http://localhost:%d\n", config.ServerPort)
	http.ListenAndServe(fmt.Sprintf(":%d", config.ServerPort), nil)
}

func systemInfoHandler(w http.ResponseWriter, r *http.Request) {
	// Get the config file
	configFile, err := os.Open("config.json")
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

func getGPUInfo() (map[string]interface{}, error) {
    cmd := exec.Command("nvidia-smi", "--query-gpu=uuid,name,temperature.gpu,utilization.gpu,utilization.memory,memory.total,memory.used,memory.free", "--format=csv,noheader,nounits")
    cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
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
		fmt.Fprintf(os.Stderr, "Fatale fout: %s\n", err.Error())
		os.Exit(1)
	}
}
