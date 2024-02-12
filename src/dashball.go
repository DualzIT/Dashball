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

	"github.com/shirou/gopsutil/cpu"
	"github.com/shirou/gopsutil/disk"
	"github.com/shirou/gopsutil/host"
	"github.com/shirou/gopsutil/mem"
)

func main() {
	// Webserver
	websiteDir := filepath.Join(".", "Website")
	fs := http.FileServer(http.Dir(websiteDir))
	http.Handle("/", fs)
	// Sends json to /system_info
	http.HandleFunc("/system_info", systemInfoHandler)
	fmt.Println("Server started on http://localhost:80")
	http.ListenAndServe(":80", nil)
}

func systemInfoHandler(w http.ResponseWriter, r *http.Request) {
	// CPU Usage
	cpuUsage, _ := cpu.Percent(0, false)
	cpuUsageX10 := cpuUsage[0] * 2
	roundedCPUUsage := fmt.Sprintf("%.0f", cpuUsageX10)

	// Memory Usage
	vMem, _ := mem.VirtualMemory()

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
		"total_memory":            vMem.Total,
		"used_memory":             vMem.Used,
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
