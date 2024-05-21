        document.addEventListener("DOMContentLoaded", function () { 
        const maxDataPoints = 30; // Data points

        let gpuUsageChart;
        let gpuMemoryChart;
        let diskChart;

        const ctxGpuUsage = document.getElementById('gpuUsageChart').getContext('2d');
        const ctxGpuMemory = document.getElementById('gpuMemoryChart').getContext('2d');

        function initializeCharts() {
          
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
                        }
                    }
                }
            });
        }

        function updateData() {
            // Get JSON data
            fetch('/system_info')
                .then(response => response.json())
                .then(data => {
                    const now = new Date();
                    const timestamp = now.toLocaleTimeString();
                    
                    // Ads the y scale for gpu memory
                    gpuMemoryChart.options.scales.y.max = parseFloat(data.gpu_info.gpu0.memory_total);


                    // Add timestamp as a label
                 
                    gpuUsageChart.data.labels.push(timestamp);
                    gpuMemoryChart.data.labels.push(timestamp);

            // Shift chart when it hits maxdatapoints
                    if (gpuUsageChart.data.labels.length > maxDataPoints) { 
                        gpuUsageChart.data.labels.shift();
                        gpuMemoryChart.data.labels.shift();
                        gpuUsageChart.data.datasets[0].data.shift();
                        gpuMemoryChart.data.datasets[0].data.shift();
                    }


                    document.getElementById('gpu_usage').textContent = `GPU Usage: ${data.gpu_info.gpu0.utilization_gpu}%`;
                    document.getElementById('gpu_memory').textContent = `GPU Memory: ${data.gpu_info.gpu0.memory_used}MB / ${data.gpu_info.gpu0.memory_total}MB`;
                    document.getElementById('gpu_name').textContent = `${data.gpu_info.gpu0.name}`;
                    document.getElementById('gpu_temperature').textContent = `${data.gpu_info.gpu0.temperature_gpu}°C`;

             

                    
                    gpuUsageChart.data.datasets[0].data.push(data.gpu_info.gpu0.utilization_gpu);
                    gpuMemoryChart.data.datasets[0].data.push(data.gpu_info.gpu0.memory_used);

                    gpuUsageChart.update();
                    gpuMemoryChart.update();

                })
                .catch(error => {
                    console.error('ERROR:', error);
                });
        }

        initializeCharts();
        updateData();
        setInterval(updateData, 1000);
    });