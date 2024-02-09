from http.server import SimpleHTTPRequestHandler
from socketserver import TCPServer
import threading
import time
import json
import psutil
import os
import platform
import socket

if platform.system() == 'Windows':
    parent_directory = '..\\'
else:
    parent_directory = '../'
    os.chdir(parent_directory)

class SystemInfoHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/system_info':
            # CPU
            cpu_percent_per_core = psutil.cpu_percent()
            cpu_usage = (cpu_percent_per_core * 2)
            # Disk
            disk_usage = psutil.disk_usage('/')
            used_space_gb = round(disk_usage.used / (1024 ** 3), 2)
            total_space_gb = round(disk_usage.total / (1024 ** 3), 2)
            available_disk_gb = round(disk_usage.free / (1024 ** 3), 2)
            # Initialize GPU values as None
            gpu = None
            gpu_driver = None
            gpu_temperature = None
            GPU_memory_total = None
            GPU_memory_free = None
            GPU_memory_used = None
            gpu_usage = None
            try:
                from py3nvml import py3nvml
                py3nvml.nvmlInit()
                handle = py3nvml.nvmlDeviceGetHandleByIndex(0)
                gpu = py3nvml.nvmlDeviceGetName(handle)
                gpu_driver = py3nvml.nvmlSystemGetDriverVersion()
                gpu_temperature = py3nvml.nvmlDeviceGetTemperature(handle, py3nvml.NVML_TEMPERATURE_GPU)
                memory_info = py3nvml.nvmlDeviceGetMemoryInfo(handle)
                GPU_memory_total = round(memory_info.total / (1024 ** 2))  # Transform to MB
                GPU_memory_free = round(memory_info.free / (1024 ** 2))    # Transform to MB
                GPU_memory_used = round(memory_info.used / (1024 ** 2))    # Transform to MB
                gpu_usage = py3nvml.nvmlDeviceGetUtilizationRates(handle).gpu
                py3nvml.nvmlShutdown()
            except ImportError:
                gpu = "N/A"
                gpu_driver = "N/A"
                gpu_temperature = "N/A"
                GPU_memory_total = "N/A"
                GPU_memory_free = "N/A"
                GPU_memory_used = "N/A"
                gpu_usage = "N/A"
            except Exception as e:
                print(f"Error getting GPU info: {e}")

            # Memory
            memory_usage = psutil.virtual_memory().percent

            # System info
            os_version = platform.platform()
            hostname = socket.gethostname()
            ip_addresses = socket.gethostbyname_ex(hostname)[2]

            # JSON data
            data = {
                "cpu_usage": cpu_usage,
                "memory_usage": memory_usage,
                "used_space_gb": used_space_gb,
                "total_space_gb": total_space_gb,
                "available_space_gb": available_disk_gb,
                "gpu_name": gpu,
                "gpu_driver": gpu_driver,
                "gpu_temperature": gpu_temperature,
                "gpu_memory_total": GPU_memory_total,
                "gpu_memory_free": GPU_memory_free,
                "gpu_memory_used": GPU_memory_used,
                "gpu_usage": gpu_usage,
                "hostname": hostname,
                "ip_address": ip_addresses,
                "os_version": os_version,
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
