from http.server import SimpleHTTPRequestHandler
from socketserver import TCPServer
from py3nvml import py3nvml
import threading
import time
import json
import psutil
import GPUtil


class SystemInfoHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/system_info':
            py3nvml.nvmlInit()
            handle = py3nvml.nvmlDeviceGetHandleByIndex(0)
            # CPU
            cpu_percent_per_core = psutil.cpu_percent(interval=None, percpu=True)  
            cpu_usage = [round(usage, 2) for usage in cpu_percent_per_core]
            # Disk
            disk_usage = psutil.disk_usage('/')
            used_space_gb = round(disk_usage.used / (1024 ** 3), 2)  
            total_space_gb = round(disk_usage.total / (1024 ** 3), 2)  
            available_disk_gb = round(disk_usage.free / (1024 ** 3), 2)
            # GPU        
            gpu = GPUtil.getGPUs()[0]
            gpu_usage = round(gpu.load * 100, 2)
            temperature = py3nvml.nvmlDeviceGetTemperature(handle, py3nvml.NVML_TEMPERATURE_GPU)
            memory_info = py3nvml.nvmlDeviceGetMemoryInfo(handle)
            GPU_memory_total = round(memory_info.total / (1024 ** 2))  # Transform to  MB
            GPU_memory_free = round(memory_info.free / (1024 ** 2))    # Transform to  MB
            GPU_memory_used = round(memory_info.used / (1024 ** 2))    # Transform to  MB    
            # memory
            memory_usage = psutil.virtual_memory().percent
            
            # JSON data
            data = {
                    "cpu_usage": cpu_usage,
                    "memory_usage": memory_usage,
                    "used_space_gb": used_space_gb,
                    "total_space_gb": total_space_gb,
                    "available_space_gb": available_disk_gb,
                    "gpu_name": gpu.name,
                    "gpu_driver": gpu.driver,
                    "gpu_temperature": temperature,
                    "gpu_memory_total": GPU_memory_total,
                    "gpu_memory_free": GPU_memory_free,
                    "gpu_memory_used": GPU_memory_used,
                    "gpu_usage": gpu_usage
                
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
    with TCPServer(('0.0.0.0', 8000), SystemInfoHandler) as httpd:
        print('Server started on http://localhost:80')
        httpd.serve_forever()

if __name__ == '__main__':
    server_thread = threading.Thread(target=run_server)
    server_thread.start()
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print('Server has been stopt')
