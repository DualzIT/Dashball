document.addEventListener("DOMContentLoaded", function () {
    let gpuUsageChart;
    let gpuMemoryChart;
    let gpuClockSpeedChart;
    let gpuMemoryClockSpeedChart;
    let gpuEncoderChart;
    let gpuDecoderChart;
    let config;
    const charts = [];

    const ctxGpuUsage = document.getElementById('gpuUsageChart').getContext('2d');
    const ctxGpuMemory = document.getElementById('gpuMemoryChart').getContext('2d');
    const ctxGpuClockSpeed = document.getElementById('gpuClockSpeedChart').getContext('2d');
    const ctxGpuMemoryClockSpeed = document.getElementById('gpuMemoryClockSpeedChart').getContext('2d');
    const ctxGpuEncoder = document.getElementById('gpuEncoderChart').getContext('2d');
    const ctxGpuDecoder = document.getElementById('gpuDecoderChart').getContext('2d');

    function initializeCharts() {
        // Common chart options
        const chartOptions = {
            animation: config.animations,
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100
                }
            }
        };

        // GPU usage
        gpuUsageChart = new Chart(ctxGpuUsage, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'GPU Usage (%)',
                    data: [],
                    fill: false,
                    borderColor: 'rgb(255, 99, 132)',
                }]
            },
            options: chartOptions
        });
        charts.push(gpuUsageChart);

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
                animation: config.animations,
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                    }
                }
            }
        });
        charts.push(gpuMemoryChart);

        // GPU clock speed
        gpuClockSpeedChart = new Chart(ctxGpuClockSpeed, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'GPU Clock Speed (MHz)',
                    data: [],
                    fill: false,
                    borderColor: 'rgb(153, 102, 255)',
                }]
            },
            options: {
                animation: config.animations,
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                    }
                }
            }
        });
        charts.push(gpuClockSpeedChart);

        // GPU memory clock speed
        gpuMemoryClockSpeedChart = new Chart(ctxGpuMemoryClockSpeed, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'GPU Memory Clock Speed (MHz)',
                    data: [],
                    fill: false,
                    borderColor: 'rgb(255, 159, 64)',
                }]
            },
            options: {
                animation: config.animations,
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                    }
                }
            }
        });
        charts.push(gpuMemoryClockSpeedChart);

        // GPU encoder utilization
        gpuEncoderChart = new Chart(ctxGpuEncoder, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'GPU Encoder Utilization (%)',
                    data: [],
                    fill: false,
                    borderColor: 'rgb(54, 162, 235)',
                }]
            },
            options: chartOptions
        });
        charts.push(gpuEncoderChart);

        // GPU decoder utilization
        gpuDecoderChart = new Chart(ctxGpuDecoder, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'GPU Decoder Utilization (%)',
                    data: [],
                    fill: false,
                    borderColor: 'rgb(255, 205, 86)',
                }]
            },
            options: chartOptions
        });
        charts.push(gpuDecoderChart);
    }

    function updateData() {
        fetch('/system_info')
            .then(response => response.json())
            .then(data => {
                const now = new Date();
                const timestamp = now.toLocaleTimeString();

                // Set y-axis max for GPU memory chart
                gpuMemoryChart.options.scales.y.max = parseFloat(data.gpu_info.gpu0.memory_total);

                // Add timestamp as a label to all charts
                charts.forEach(chart => {
                    chart.data.labels.push(timestamp);
                    if (chart.data.labels.length > config.max_data_points) {
                        chart.data.labels.shift();
                        chart.data.datasets[0].data.shift();
                    }
                });

                // Update text elements
                document.getElementById('gpu_usage').textContent = `GPU Usage: ${data.gpu_info.gpu0.utilization_gpu}%`;
                document.getElementById('gpu_memory').textContent = `GPU Memory: ${data.gpu_info.gpu0.memory_used}MB / ${data.gpu_info.gpu0.memory_total}MB`;
                document.getElementById('gpu_name').textContent = `${data.gpu_info.gpu0.name}`;
                document.getElementById('gpu_temperature').textContent = `${data.gpu_info.gpu0.temperature_gpu}°C`;
                document.getElementById('gpu_fan_speed').textContent = `${data.gpu_info.gpu0.fan_speed}%`;
                document.getElementById('gpu_clock_speed').textContent = `GPU Clock Speed: ${data.gpu_info.gpu0.clock_speed} MHz`;
                document.getElementById('gpu_memory_clock_speed').textContent = `GPU Memory Clock Speed: ${data.gpu_info.gpu0.memory_clock_speed} MHz`;
                document.getElementById('gpu_encoder').textContent = `GPU Encoder Utilization: ${data.gpu_info.gpu0.encoder_utilization}%`;
                document.getElementById('gpu_decoder').textContent = `GPU Decoder Utilization: ${data.gpu_info.gpu0.decoder_utilization}%`;

                // Update chart data
                gpuUsageChart.data.datasets[0].data.push(data.gpu_info.gpu0.utilization_gpu);
                gpuMemoryChart.data.datasets[0].data.push(data.gpu_info.gpu0.memory_used);
                gpuClockSpeedChart.data.datasets[0].data.push(data.gpu_info.gpu0.clock_speed);
                gpuMemoryClockSpeedChart.data.datasets[0].data.push(data.gpu_info.gpu0.memory_clock_speed);
                gpuEncoderChart.data.datasets[0].data.push(data.gpu_info.gpu0.encoder_utilization);
                gpuDecoderChart.data.datasets[0].data.push(data.gpu_info.gpu0.decoder_utilization);

                // Update all charts
                charts.forEach(chart => chart.update());
            })
            .catch(error => {
                console.error('ERROR:', error);
            });
    }

    fetch('../webconfig.json')
        .then(response => response.json())
        .then(data => {
            config = data;
            initializeCharts();
            updateData();
            setInterval(updateData, config.update_interval_seconds * 1000); // Use interval in milliseconds
        })
        .catch(error => {
            console.error('Error fetching configuration:', error);
        });
});
