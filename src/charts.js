        document.addEventListener("DOMContentLoaded", function () { 
        const maxDataPoints = 30; // Data points
        let cpuChart;
        let memoryChart;
        let gpuUsageChart;
        let gpuMemoryChart;
        let diskChart;

        const ctxCpu = document.getElementById('cpuChart').getContext('2d');
        const ctxMemory = document.getElementById('memoryChart').getContext('2d');
        const ctxGpuUsage = document.getElementById('gpuUsageChart').getContext('2d');
        const ctxGpuMemory = document.getElementById('gpuMemoryChart').getContext('2d');
        const ctxDisk = document.getElementById('diskChart').getContext('2d');

        function initializeCharts() {
            // CPU usage
            cpuChart = new Chart(ctxCpu, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'CPU Usage (%)',
                        data: [],
                        borderColor: 'rgb(75, 192, 192)',
                    }]
                },
                options: {
                    scales: {

                        y: {
                            beginAtZero: true,
                            max: 100
                        }
                    }
                }
            });
            // Memory usage
            memoryChart = new Chart(ctxMemory, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Memory Usage (%)',
                        data: [],
                        borderColor: 'rgb(153, 102, 255)',
                        
                    }]
                },
                options: {
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100
                        }
                    }
                }
            });
            // GPU usage
            gpuUsageChart = new Chart(ctxGpuUsage, {
                type: 'line',
                data: {
                    datasets: [{
                        label: 'GPU Usage (%)',
                        data: [],
                        fill: false,
                        borderColor: 'rgb(255, 99, 132)',
                    }]
                },
                options: {
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100
                        }
                    }
                }
            });
            // GPU memory usage
            gpuMemoryChart = new Chart(ctxGpuMemory, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'GPU Memory (MB)',
                        data: [],
                        fill: false,
                        borderColor: 'rgb(75, 192, 192)',
                        tension: 0.1
                    }]
                },
                options: {
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 2048
                            // hardcoded for now
                        }
                    }
                }
            });
            // Disk
            diskChart = new Chart(ctxDisk, {
                type: 'doughnut',
                data: {
                    labels: ['Used Space (GB) ', 'Free Space (GB)'],
                    datasets: [{
                        data: [],
                        backgroundColor: ['#F9B94B', '#6FF36F'],
                        borderWidth: 0
                    }]
                },
            });
        }

        function updateData() {
            // Get JSON data
            fetch('/system_info')
                .then(response => response.json())
                .then(data => {
                    const now = new Date();
                    const timestamp = now.toLocaleTimeString();
                    
                    // Add timestamp as a label
                    cpuChart.data.labels.push(timestamp);
                    memoryChart.data.labels.push(timestamp);
                    gpuUsageChart.data.labels.push(timestamp);
                    gpuMemoryChart.data.labels.push(timestamp);

            // Shift chart when it hits maxdatapoints
                    if (cpuChart.data.labels.length > maxDataPoints) {
                        cpuChart.data.labels.shift();
                        memoryChart.data.labels.shift();
                        gpuUsageChart.data.labels.shift();
                        gpuMemoryChart.data.labels.shift();
                        cpuChart.data.datasets[0].data.shift();
                        memoryChart.data.datasets[0].data.shift();
                        gpuUsageChart.data.datasets[0].data.shift();
                        gpuMemoryChart.data.datasets[0].data.shift();
                    }

                    document.getElementById('cpu_usage').textContent = `CPU: ${data.cpu_usage}%`;
                    document.getElementById('memory_usage').textContent = `Memory: ${data.memory_usage}%`;
                    document.getElementById('gpu_usage').textContent = `GPU Usage: ${data.gpu_usage}%`;
                    document.getElementById('gpu_memory').textContent = `GPU Memory: ${data.gpu_memory_used}MB / ${data.gpu_memory_total}MB`;
                    document.getElementById('used_disk_gb').textContent = `Used: ${data.used_space_gb}GB`;
                    document.getElementById('total_disk_gb').textContent = `Total: ${data.total_space_gb}GB`;
                    document.getElementById('free_disk_gb').textContent = `Free: ${data.available_space_gb}GB`;
                    document.getElementById('gpu_name').textContent = `Name: ${data.gpu_name}`;
                    document.getElementById('gpu_driver').textContent = `Driver version: ${data.gpu_driver}`;
                    document.getElementById('gpu_temperature').textContent = `Temperature: ${data.gpu_temperature}°C`;
             

                    cpuChart.data.datasets[0].data.push(data.cpu_usage);
                    memoryChart.data.datasets[0].data.push(data.memory_usage);
                    gpuUsageChart.data.datasets[0].data.push(data.gpu_usage);
                    gpuMemoryChart.data.datasets[0].data.push(data.gpu_memory_used);
                    diskChart.data.datasets[0].data = [data.used_space_gb, data.available_space_gb];
                   
                    diskChart.update();
                    cpuChart.update();
                    memoryChart.update();
                    gpuUsageChart.update();
                    gpuMemoryChart.update();

                })
                .catch(error => {
                    console.error('Fout bij het ophalen van systeeminformatie:', error);
                });
        }

        initializeCharts();
        updateData();
        setInterval(updateData, 1000);
    });