document.addEventListener("DOMContentLoaded", function () {
    let cpuChart;
    let memoryChart;
    let gpuUsageChart;
    let gpuMemoryChart;
    let config;
    let activeComputer = 'Local'; // Default active computer is Local

    const ctxCpu = document.getElementById('cpuChart').getContext('2d');
    const ctxMemory = document.getElementById('memoryChart').getContext('2d');
    const ctxGpuUsage = document.getElementById('gpuUsageChart').getContext('2d');
    const ctxGpuMemory = document.getElementById('gpuMemoryChart').getContext('2d');

    function initializeCharts() {
        const chartOptions = {
            animation: config.animations, // Use the animation setting from config
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100
                }
            }
        };

        cpuChart = new Chart(ctxCpu, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'CPU Usage (%)',
                    data: [],
                    borderColor: 'rgb(75, 192, 192)',
                    fill: false
                }]
            },
            options: chartOptions
        });

        memoryChart = new Chart(ctxMemory, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Memory Usage (%)',
                    data: [],
                    borderColor: 'rgb(153, 102, 255)',
                    fill: false
                }]
            },
            options: chartOptions
        });

        gpuUsageChart = new Chart(ctxGpuUsage, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'GPU Usage (%)',
                    data: [],
                    borderColor: 'rgb(255, 99, 132)',
                    fill: false
                }]
            },
            options: chartOptions
        });

        gpuMemoryChart = new Chart(ctxGpuMemory, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'GPU Memory (MB)',
                    data: [],
                    borderColor: 'rgb(75, 192, 192)',
                    fill: false
                }]
            },
            options: {
                animation: config.animations,
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        // Customize the max value for GPU memory based on the fetched data
                    }
                }
            }
        });
    }

    function updateData() {
        // Fetch data from /system_info_all
        fetch('/system_info_all')
            .then(response => response.json())
            .then(data => {
                const now = new Date();
                const timestamp = now.toLocaleTimeString();

                // Retrieve data for the active computer
                const activeData = data[`system_info_${activeComputer}`];

                if (!activeData) {
                    console.error(`No data found for active computer: ${activeComputer}`);
                    return;
                }

                // Update GPU Memory Chart y-axis max based on the fetched data
                gpuMemoryChart.options.scales.y.max = parseFloat(activeData.gpu_info.gpu0.memory_total);

                // Add timestamp as a label
                cpuChart.data.labels.push(timestamp);
                memoryChart.data.labels.push(timestamp);
                gpuUsageChart.data.labels.push(timestamp);
                gpuMemoryChart.data.labels.push(timestamp);

                // Shift chart when it hits maxdatapoints
                if (cpuChart.data.labels.length > config.max_data_points) {
                    cpuChart.data.labels.shift();
                    memoryChart.data.labels.shift();
                    gpuUsageChart.data.labels.shift();
                    gpuMemoryChart.data.labels.shift();
                    cpuChart.data.datasets[0].data.shift();
                    memoryChart.data.datasets[0].data.shift();
                    gpuUsageChart.data.datasets[0].data.shift();
                    gpuMemoryChart.data.datasets[0].data.shift();
                }

                document.getElementById('cpu_usage').textContent = `CPU: ${activeData.cpu_usage}`;
                document.getElementById('memory_usage').textContent = `Memory: ${activeData.memory_usage.toFixed(1)}%`;
                document.getElementById('total_memory').textContent = `${activeData.total_memory.toFixed(1)} GB`;
                document.getElementById('used_memory').textContent = `${activeData.used_memory.toFixed(1)} GB`;
                document.getElementById('gpu_usage').textContent = `GPU Usage: ${activeData.gpu_info.gpu0.utilization_gpu}%`;
                document.getElementById('gpu_memory').textContent = `GPU Memory: ${activeData.gpu_info.gpu0.memory_used}MB / ${activeData.gpu_info.gpu0.memory_total}MB`;
                document.getElementById('gpu_name').textContent = `${activeData.gpu_info.gpu0.name}`;
                document.getElementById('gpu_temperature').textContent = `${activeData.gpu_info.gpu0.temperature_gpu}°C`;
                document.getElementById('computer_name').textContent = `${activeData.hostname}`;
                document.getElementById('os').textContent = `${activeData.platform}`;
                document.getElementById('os_version').textContent = `${activeData.platform_version}`;

                cpuChart.data.datasets[0].data.push(activeData.cpu_usage);
                memoryChart.data.datasets[0].data.push(activeData.memory_usage);
                gpuUsageChart.data.datasets[0].data.push(activeData.gpu_info.gpu0.utilization_gpu);
                gpuMemoryChart.data.datasets[0].data.push(activeData.gpu_info.gpu0.memory_used);

                cpuChart.update();
                memoryChart.update();
                gpuUsageChart.update();
                gpuMemoryChart.update();
            })
            .catch(error => {
                console.error('ERROR:', error);
            });
    }

    // Handle tab selection and change the active computer
    document.getElementById('computer-tabs').addEventListener('click', function (event) {
        if (event.target.tagName === 'LI') {
            const selectedTab = event.target;
            activeComputer = selectedTab.getAttribute('data-computer-name');
            document.querySelectorAll('#computer-tabs li').forEach(tab => tab.classList.remove('active'));
            selectedTab.classList.add('active');
            updateData(); // Immediately update data when tab changes
        }
    });

    // Fetch the configuration
    fetch('../webconfig.json')
        .then(response => response.json())
        .then(data => {
            config = data;
            initializeCharts();
            updateData();
            setInterval(updateData, config.update_interval_seconds * 1000); // Use interval in milliseconds
        })
        .catch(error => {
            console.error('ERROR:', error);
        });
});
