//go:build windows
// +build windows

package main

import (
    "os/exec"
    "strconv"
    "strings"
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

func getProcessGPUMemoryUsage() map[int]int {
    cmd := exec.Command("nvidia-smi")
    cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
    output, err := cmd.Output()
    if err != nil {
        return map[int]int{}
    }

    usage := make(map[int]int)
    lines := strings.Split(string(output), "\n")

    inProcessSection := false
    for _, line := range lines {
        line = strings.TrimSpace(line)

        if strings.HasPrefix(line, "|====") {
            inProcessSection = true
            continue
        }

        if inProcessSection && strings.HasPrefix(line, "|") {
            fields := strings.Fields(line)
            if len(fields) < 8 {
                continue
            }

            pidStr := fields[4]
            memStr := fields[len(fields)-2] 

            pid, err1 := strconv.Atoi(pidStr)
            memClean := strings.TrimSuffix(memStr, "MiB")
            memMB, err2 := strconv.Atoi(memClean)

            if err1 == nil && err2 == nil {
                usage[pid] = memMB
            }
        }
    }

    return usage
}
