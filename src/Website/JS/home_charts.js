document.addEventListener("DOMContentLoaded", function () {
    let cpuChart;
    let memoryChart;
    let gpuUsageChart;
    let gpuMemoryChart;
    let config;
    let activeComputer = 'Local';
    let computers = [];

    const ctxCpu = document.getElementById('cpuChart').getContext('2d');
    const ctxMemory = document.getElementById('memoryChart').getContext('2d');
    const ctxGpuUsage = document.getElementById('gpuUsageChart').getContext('2d');
    const ctxGpuMemory = document.getElementById('gpuMemoryChart').getContext('2d');

    function initializeCharts() {
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
                    }
                }
            }
        });
    }

    function resetCharts() {
        cpuChart.data.labels = [];
        cpuChart.data.datasets[0].data = [];

        memoryChart.data.labels = [];
        memoryChart.data.datasets[0].data = [];

        gpuUsageChart.data.labels = [];
        gpuUsageChart.data.datasets[0].data = [];

        gpuMemoryChart.data.labels = [];
        gpuMemoryChart.data.datasets[0].data = [];

        cpuChart.update();
        memoryChart.update();
        gpuUsageChart.update();
        gpuMemoryChart.update();
    }

    function connectWebSocket(computer) {
        const url = `ws://${computer.ip}:${computer.port}/ws`;
        console.log(`Connecting to WebSocket at ${url} for computer: ${computer.name}`);

        const socket = new WebSocket(url);

        socket.onmessage = function (event) {
            try {
                const data = JSON.parse(event.data);

                // Check if the received data is for the active computer
                if (computer.name !== activeComputer) {
                    console.log(`Received data for ${computer.name}, but ${activeComputer} is active. Ignoring.`);
                    return;
                }

                console.log(`Processing data for active computer: ${computer.name}`);
                
                const now = new Date();
                const timestamp = now.toLocaleTimeString();

                gpuMemoryChart.options.scales.y.max = parseFloat(data.gpu_info.gpu0.memory_total);

                cpuChart.data.labels.push(timestamp);
                memoryChart.data.labels.push(timestamp);
                gpuUsageChart.data.labels.push(timestamp);
                gpuMemoryChart.data.labels.push(timestamp);

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

                document.getElementById('cpu_usage').textContent = `CPU: ${data.cpu_usage}`;
                document.getElementById('memory_usage').textContent = `Memory: ${data.memory_usage.toFixed(1)}%`;
                document.getElementById('total_memory').textContent = `${data.total_memory.toFixed(1)} GB`;
                document.getElementById('used_memory').textContent = `${data.used_memory.toFixed(1)} GB`;
                document.getElementById('gpu_usage').textContent = `GPU Usage: ${data.gpu_info.gpu0.utilization_gpu}%`;
                document.getElementById('gpu_memory').textContent = `GPU Memory: ${data.gpu_info.gpu0.memory_used}MB / ${data.gpu_info.gpu0.memory_total}MB`;
                document.getElementById('gpu_name').textContent = `${data.gpu_info.gpu0.name}`;
                document.getElementById('gpu_temperature').textContent = `${data.gpu_info.gpu0.temperature_gpu}°C`;
                document.getElementById('computer_name').textContent = `${data.hostname}`;
                document.getElementById('os').textContent = `${data.platform}`;
                document.getElementById('os_version').textContent = `${data.platform_version}`;

                cpuChart.data.datasets[0].data.push(data.cpu_usage);
                memoryChart.data.datasets[0].data.push(data.memory_usage);
                gpuUsageChart.data.datasets[0].data.push(data.gpu_info.gpu0.utilization_gpu);
                gpuMemoryChart.data.datasets[0].data.push(data.gpu_info.gpu0.memory_used);

                cpuChart.update();
                memoryChart.update();
                gpuUsageChart.update();
                gpuMemoryChart.update();
            } catch (error) {
                console.error("Error processing WebSocket message:", error);
            }
        };

        socket.onerror = function (error) {
            console.error("WebSocket error: ", error);
        };

        socket.onclose = function () {
            console.log("WebSocket connection closed. Reconnecting in 1 second...");
            setTimeout(() => connectWebSocket(computer), 1000); // Reconnect on close
        };
    }

    function fetchComputersAndConnect() {
        fetch('computers.json')
            .then(response => {
                if (!response.ok) {
                    throw new Error("Failed to fetch computers.json");
                }
                return response.json();
            })
            .then(data => {
                computers = data.computers;
                const localComputer = computers.find(comp => comp.name === 'Local');
                
                // Connect to WebSocket for each computer
                computers.forEach(computer => {
                    connectWebSocket(computer);
                });

                if (!localComputer) {
                    console.error("No local computer found in computers.json");
                    return;
                }

                activeComputer = localComputer.name;

                // Update the tabs UI
                const tabsContainer = document.getElementById('computer-tabs');
                tabsContainer.innerHTML = ''; // Clear existing tabs
                computers.forEach(computer => {
                    const tab = document.createElement('li');
                    tab.setAttribute('data-computer-name', computer.name);
                    tab.textContent = computer.name;
                    if (computer.name === activeComputer) {
                        tab.classList.add('active');
                    }
                    tabsContainer.appendChild(tab);
                });
            })
            .catch(error => {
                console.error('ERROR:', error);
            });
    }

    document.getElementById('computer-tabs').addEventListener('click', function (event) {
        if (event.target.tagName === 'LI') {
            const selectedTab = event.target;
            activeComputer = selectedTab.getAttribute('data-computer-name');
            document.querySelectorAll('#computer-tabs li').forEach(tab => tab.classList.remove('active'));
            selectedTab.classList.add('active');

            console.log(`Switched to ${activeComputer}. Resetting charts and only processing data for this computer.`);
            
            resetCharts(); // Reset charts on tab switch
        }
    });

    fetch('../webconfig.json')
        .then(response => response.json())
        .then(data => {
            config = data;
            initializeCharts();
            fetchComputersAndConnect(); // Fetch computers and then connect WebSocket
        })
        .catch(error => {
            console.error('ERROR:', error);
        });
});
