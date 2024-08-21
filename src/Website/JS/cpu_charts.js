document.addEventListener('DOMContentLoaded', () => {
    let cpuCoreCharts = {};  // Grafieken voor CPU gebruik per core
    let averageCpuChart;     // Grafiek voor gemiddelde CPU gebruik
    let config;
    let activeComputer = localStorage.getItem('activeComputer') || 'Local';  
    let computers = [];

    async function fetchConfig() {
        try {
            const response = await fetch('../webconfig.json');
            return await response.json();
        } catch (error) {
            console.error('Error fetching config:', error);
        }
    }

    function createCpuCoreCharts(coreCount) {
        const chartsContainer = document.getElementById('cpuchartsContainer');
        chartsContainer.innerHTML = '';  // Clear existing charts

        for (let i = 0; i < coreCount; i++) {
            const canvasWrapper = document.createElement('div');
            canvasWrapper.className = 'cpu-chart-item'; // Flexbox item class
            const canvas = document.createElement('canvas');
            canvas.id = `coreChart${i}`;
            canvasWrapper.appendChild(canvas);
            chartsContainer.appendChild(canvasWrapper);

            cpuCoreCharts[i] = new Chart(canvas, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: `Core ${i} Usage`,
                        data: [],
                        borderColor: `rgba(255, 99, 132, 1)`,
                        borderWidth: 1,
                        fill: false
                    }]
                },
                options: {
                    animation: config.animations,
                    responsive: true,
                    scales: {
                        x: { title: { display: true } },
                        y: {
                            beginAtZero: true,
                            max: 100,
                            title: { display: true, text: 'CPU Usage (%)' }
                        }
                    }
                }
            });
        }
    }

    function createAverageCpuChart() {
        const averageCpuCanvas = document.getElementById('averageCpuChart');
        averageCpuChart = new Chart(averageCpuCanvas, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Average CPU Usage',
                    data: [],
                    borderColor: 'rgb(75, 192, 192)',
                    borderWidth: 1,
                    fill: false
                }]
            },
            options: {
                animation: config.animations,
                responsive: true,
                scales: {
                    x: { title: { display: true } },
                    y: {
                        beginAtZero: true,
                        max: 100,
                        title: { display: true, text: 'CPU Usage (%)' }
                    }
                }
            }
        });
    }

    function updateCpuCharts(data) {
        const timestamp = new Date().toLocaleTimeString();

        // Update CPU Core Charts
        data.cpu_usage_per_core.forEach((usage, index) => {
            const chart = cpuCoreCharts[index];
            if (chart) {
                chart.data.labels.push(timestamp);
                chart.data.datasets[0].data.push(usage);

                if (chart.data.labels.length > config.max_data_points) {
                    chart.data.labels.shift();
                    chart.data.datasets[0].data.shift();
                }

                chart.update('none');
            }
        });

        // Update Average CPU Chart
        if (averageCpuChart) {
            averageCpuChart.data.labels.push(timestamp);
            averageCpuChart.data.datasets[0].data.push(data.cpu_usage);

            if (averageCpuChart.data.labels.length > config.max_data_points) {
                averageCpuChart.data.labels.shift();
                averageCpuChart.data.datasets[0].data.shift();
            }

            averageCpuChart.update('none');
        }

        updateCpuInfoText(data.cpu_info);
    }

    function updateCpuInfoText(cpuInfo) {
        setTextContent('cpu_name', cpuInfo.name);
        setTextContent('cpu_temperature', `${cpuInfo.temperature} °C`);
        setTextContent('cpu_frequency', `${cpuInfo.frequency} MHz`);
        setTextContent('cpu_cores', cpuInfo.cores);
        setTextContent('cpu_uptime', cpuInfo.uptime);
        setTextContent('cpu_threads', cpuInfo.threads);
        setTextContent('cpu_usage', cpuInfo.cpu_usage);
    }

    function setTextContent(elementId, text) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = text;
        } else {
            console.warn(`Element with ID ${elementId} not found.`);
        }
    }

    function setupWebSocket(computer) {
        const url = `ws://${computer.ip}:${computer.port}/ws`;
        const socket = new WebSocket(url);

        socket.onmessage = function (event) {
            try {
                const data = JSON.parse(event.data);
                if (activeComputer === computer.name) {
                    if (!averageCpuChart || Object.keys(cpuCoreCharts).length === 0) {
                        createCpuCoreCharts(data.cpu_usage_per_core.length);
                        createAverageCpuChart();
                    }
                    updateCpuCharts(data);
                }
            } catch (error) {
                console.error("Error processing WebSocket message:", error);
            }
        };

        socket.onerror = function (error) {
            console.error(`WebSocket error for ${computer.name}:`, error);
        };

        socket.onclose = function () {
            console.log(`WebSocket connection closed for ${computer.name}. Reconnecting...`);
            setTimeout(() => setupWebSocket(computer), 1000);
        };
    }

    async function fetchComputersAndConnect() {
        try {
            const response = await fetch('computers.json');
            const data = await response.json();

            if (data.computers && Array.isArray(data.computers)) {
                computers = data.computers;
                computers.forEach(computer => {
                    setupWebSocket(computer);
                });

                updateComputerTabs(computers);
            } else {
                console.error("Invalid computers.json format.");
            }
        } catch (error) {
            console.error("Error fetching computers:", error);
        }
    }

    function updateComputerTabs(computers) {
        const tabsContainer = document.getElementById('computer-tabs');
        tabsContainer.innerHTML = '';

        computers.forEach(computer => {
            const tab = document.createElement('li');
            tab.setAttribute('data-computer-name', computer.name);
            tab.textContent = computer.name;
            if (computer.name === activeComputer) {
                tab.classList.add('active');
            }
            tabsContainer.appendChild(tab);
        });
    }

    document.getElementById('computer-tabs').addEventListener('click', function (event) {
        if (event.target.tagName === 'LI') {
            activeComputer = event.target.getAttribute('data-computer-name');
            localStorage.setItem('activeComputer', activeComputer);  
            document.querySelectorAll('#computer-tabs li').forEach(tab => tab.classList.remove('active'));
            event.target.classList.add('active');

            // Clear charts when switching tabs
            if (averageCpuChart) {
                averageCpuChart.data.labels = [];
                averageCpuChart.data.datasets[0].data = [];
                averageCpuChart.update();
            }

            for (let key in cpuCoreCharts) {
                cpuCoreCharts[key].data.labels = [];
                cpuCoreCharts[key].data.datasets[0].data = [];
                cpuCoreCharts[key].update();
            }
        }
    });

    fetchConfig().then(cfg => {
        config = cfg;
        fetchComputersAndConnect();
    }).catch(error => {
        console.error('Error fetching configuration:', error);
    });
});
