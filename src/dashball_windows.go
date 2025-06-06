//go:build windows
// +build windows

package main

import (
    "os/exec"
    "syscall"
  
)

func getNvidiaGPUInfo() (map[string]interface{}, error) {
    cmd := exec.Command("nvidia-smi", "--query-gpu=name,uuid,temperature.gpu,utilization.gpu,memory.total,memory.used,memory.free,fan.speed,clocks.gr,clocks.mem,utilization.encoder,utilization.decoder", "--format=csv,noheader,nounits")
    cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
    output, err := cmd.Output()
    return parseNvidiaSmiOutput(output, err)
}

func getProcessGPUUsage() map[int]int {
    cmd := exec.Command("nvidia-smi", "pmon", "-c", "1")
    cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
    output, err := cmd.Output()
    return parseNvidiaSmiPmonOutput(output, err)
}