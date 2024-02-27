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
	
	"github.com/shirou/gopsutil/disk"
	"github.com/shirou/gopsutil/host"
	"github.com/shirou/gopsutil/mem"
	"github.com/shirou/gopsutil/cpu"
)

type Config struct {
	ServerPort            int `json:"port"`
	UpdateIntervalSeconds int `json:"update_interval_seconds"`
}

func startTrayIcon() {
	cmd := exec.Command("powershell.exe", "-File", "trayicon.ps1")
	cmd.Stderr = os.Stderr // Vang standaard fouten op
	cmd.Stdout = os.Stdout // Vang standaard uitvoer op
	err := cmd.Start()
	if err != nil {
		log.Fatalf("Failed to start tray icon script: %v", err)
	}
}

func main() {
	startTrayIcon()
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
		fmt.Println("Can't decode config file:", err)
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
	// Verkrijg CPU-gebruikspercentages voor elke core
	cpuPercentages, err := cpu.Percent(time.Second, true) // true voor per-CPU statistieken
	if err != nil {
		log.Printf("Fout bij het ophalen van CPU percentages: %s\n", err)
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	// Bereken het gemiddelde CPU-gebruik
	var total float64
	for _, cp := range cpuPercentages {
		total += cp
	}
	average := total / float64(len(cpuPercentages))
	roundedAverageCPUUsage := fmt.Sprintf("%.2f%%", average)

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
		"cpu_usage":               roundedAverageCPUUsage,
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
}

func getGPUInfo() (map[string]interface{}, error) {
	cmd := exec.Command("nvidia-smi", "--query-gpu=uuid,name,temperature.gpu,utilization.gpu,utilization.memory,memory.total,memory.used,memory.free", "--format=csv,noheader,nounits")
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	output, err := cmd.CombinedOutput()
	if err != nil {
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
