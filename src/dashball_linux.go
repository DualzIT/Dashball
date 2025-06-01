//go:build !windows
// +build !windows

package main

import (
    "os/exec"
   
)

func getNvidiaGPUInfo() (map[string]interface{}, error) {
    cmd := exec.Command("nvidia-smi", "--query-gpu=name,uuid,temperature.gpu,utilization.gpu,memory.total,memory.used,memory.free,fan.speed,clocks.gr,clocks.mem,utilization.encoder,utilization.decoder", "--format=csv,noheader,nounits")
    output, err := cmd.Output()
    return parseNvidiaSmiOutput(output, err)
}