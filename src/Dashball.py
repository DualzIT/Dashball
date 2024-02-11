from http.server import SimpleHTTPRequestHandler
from socketserver import TCPServer
import threading
import time
import json
import psutil
import os
import platform
import socket

class SystemInfoHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/system_info':
            # CPU
            cpu_percent_per_core = psutil.cpu_percent()
            cpu_usage = round(cpu_percent_per_core, 0)  # Round to 0 decimal place
            # Disk
            disk_usage = psutil.disk_usage('/')
            used_space_gb = round(disk_usage.used / (1024 ** 3), 2)
            total_space_gb = round(disk_usage.total / (1024 ** 3), 2)
            available_disk_gb = round(disk_usage.free / (1024 ** 3), 2)
            # GPU
            gpu_info = {}
            try:
                from py3nvml import py3nvml
                py3nvml.nvmlInit()
                handle = py3nvml.nvmlDeviceGetHandleByIndex(0)
                gpu_name = py3nvml.nvmlDeviceGetName(handle)
                gpu_memory_info = py3nvml.nvmlDeviceGetMemoryInfo(handle)
                gpu_info['gpu0'] = {
                    "memory_free": round(gpu_memory_info.free / (1024 ** 2)),   # Convert bytes to MB
                    "memory_total": round(gpu_memory_info.total / (1024 ** 2)),  # Convert bytes to MB
                    "memory_used": round(gpu_memory_info.used / (1024 ** 2)),    # Convert bytes to MB
                    "name": gpu_name.decode("utf-8") if isinstance(gpu_name, bytes) else gpu_name,
                    "temperature_gpu": py3nvml.nvmlDeviceGetTemperature(handle, py3nvml.NVML_TEMPERATURE_GPU),
                    "utilization_gpu": py3nvml.nvmlDeviceGetUtilizationRates(handle).gpu,
                    "utilization_mem": py3nvml.nvmlDeviceGetUtilizationRates(handle).memory,
                    "uuid": py3nvml.nvmlDeviceGetUUID(handle).decode("utf-8") if isinstance(py3nvml.nvmlDeviceGetUUID(handle), bytes) else py3nvml.nvmlDeviceGetUUID(handle)
                }
                py3nvml.nvmlShutdown()
            except ImportError:
                pass
            except Exception as e:
                print(f"Error getting GPU info: {e}")

            # If no GPU information found, set default values to null
            if not gpu_info:
                gpu_info['gpu0'] = {
                    "memory_free": None,
                    "memory_total": None,
                    "memory_used": None,
                    "name": None,
                    "temperature_gpu": None,
                    "utilization_gpu": None,
                    "utilization_mem": None,
                    "uuid": None
                }

            # Memory
            memory_usage_raw = psutil.virtual_memory().percent
            memory_usage = round(memory_usage_raw, 0)

            # JSON data
            data = {
                "available_disk_space_gb": available_disk_gb,
                "cpu_usage": cpu_usage,
                "disk_usage_percent": round((used_space_gb / total_space_gb) * 100, 1),  # Calculate disk usage percentage
                "gpu_info": gpu_info,
                "hostname": socket.gethostname(),
                "memory_usage": memory_usage,
                "platform": platform.platform(),
                "platform_version": platform.version(),
                "total_disk_space_gb": total_space_gb,
                "total_memory": psutil.virtual_memory().total,
                "used_disk_space_gb": used_space_gb,
                "used_memory": psutil.virtual_memory().used
            }

            # Send JSON
            response = json.dumps(data)
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(response.encode('utf-8'))
        else:
            super().do_GET()


# webserver
def run_server():
    with TCPServer(('0.0.0.0', 80), SystemInfoHandler) as httpd:
        print('Server started on http://localhost:80')
        httpd.serve_forever()


if __name__ == '__main__':
    server_thread = threading.Thread(target=run_server)
    server_thread.daemon = True
    server_thread.start()
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print('Server has been stopped')
