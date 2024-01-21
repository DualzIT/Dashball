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
            cpu_percent_per_core = psutil.cpu_percent(interval=None, percpu=True)  # Verander percpu naar True
            cpu_usage = [round(usage, 2) for usage in cpu_percent_per_core]
            # CPU cores hardcoded for now
            memory_usage = psutil.virtual_memory().percent
            disk_info = self.get_disk_info()
            gpu_info = self.get_gpu_info()
    
            # Bereken de beschikbare schijfruimte
            available_disk_gb = disk_info["total_space_gb"] - disk_info["used_space_gb"]
        
            # Afronden tot 2 decimalen
            gpu_usage = round(gpu_info["gpu_usage"], 2)
            memory_used = round(gpu_info["memory_used"])
            memory_total = round(gpu_info["memory_total"])
            memory_free = round(gpu_info["memory_free"])

            data = {
                "cpu": cpu_usage,
                "memory": memory_usage,
                "disk_usage": {
                    "used_space_gb": "{:.2f}".format(disk_info["used_space_gb"]),
                    "total_space_gb": "{:.2f}".format(disk_info["total_space_gb"]),
                    "disk_usage": "{:.2f}".format(disk_info["disk_usage"]),
                    "available_space_gb": "{:.2f}".format(available_disk_gb)
                },
                "gpu": {
                    "name": gpu_info["name"],
                    "driver": gpu_info["driver"],
                    "temperature": gpu_info["temperature"],
                    "memory_total": memory_total,
                    "memory_free": memory_free,
                    "memory_used": memory_used,
                    "gpu_usage": gpu_usage
                }
            }

            response = json.dumps(data)
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(response.encode('utf-8'))
        else:
            super().do_GET()

    def get_disk_info(self):
        try:
            disk_usage = psutil.disk_usage('/')

            # Bereken de gebruikte ruimte in GB en de totale ruimte in GB
            used_space_gb = round(disk_usage.used / (1024 ** 3), 2)
            total_space_gb = round(disk_usage.total / (1024 ** 3), 2)

            # Bereken de schijfgebruikpercentage
            disk_usage = round(disk_usage.percent, 2)

            # Haal de lees- en schrijfsnelheid op in MB/s
            read_speed = round(psutil.disk_io_counters().read_bytes / (1024 ** 2), 2)
            write_speed = round(psutil.disk_io_counters().write_bytes / (1024 ** 2), 2)

            disk_info = {
                "used_space_gb": used_space_gb,
                "total_space_gb": total_space_gb,
                "disk_usage": disk_usage,
                "read_speed_mb": read_speed,
                "write_speed_mb": write_speed,
            }

            return disk_info
        except Exception as e:
            print(f"Fout bij het ophalen van schijfgegevens: {e}")
            return None

    def get_gpu_info(self):
        try:
            py3nvml.nvmlInit()
            handle = py3nvml.nvmlDeviceGetHandleByIndex(0)

            gpu = GPUtil.getGPUs()[0]
            gpu_usage = round(gpu.load * 100, 2)
            temperature = py3nvml.nvmlDeviceGetTemperature(handle, py3nvml.NVML_TEMPERATURE_GPU)
            memory_info = py3nvml.nvmlDeviceGetMemoryInfo(handle)
            memory_total = round(memory_info.total / (1024 ** 2))  # Omzetten naar MB
            memory_free = round(memory_info.free / (1024 ** 2))    # Omzetten naar MB
            memory_used = round(memory_info.used / (1024 ** 2))    # Omzetten naar MB
            gpu_info = {
                "name": gpu.name,
                "driver": gpu.driver,
                "temperature": temperature,
                "memory_total": memory_total,
                "memory_free": memory_free,
                "memory_used": memory_used,
                "gpu_usage": gpu_usage
            }
            py3nvml.nvmlShutdown()
        except ImportError:
            gpu_info = None
        
        return gpu_info

   

def run_server():
    with TCPServer(('0.0.0.0', 80), SystemInfoHandler) as httpd:
        print('Server gestart op http://localhost:80')
        httpd.serve_forever()

if __name__ == '__main__':
    server_thread = threading.Thread(target=run_server)
    server_thread.start()
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print('Server gestopt')
