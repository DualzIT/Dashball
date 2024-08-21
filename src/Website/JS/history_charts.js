document.addEventListener("DOMContentLoaded", function () {
    const ctxCpu = document.getElementById('cpuChart').getContext('2d');
    const ctxMemory = document.getElementById('memoryChart').getContext('2d');
    const currentTimeField = document.getElementById('currentTime');
    const timeSlider = document.getElementById('timeSlider');
    const updateButton = document.getElementById('updateButton');
    const datapointsInput = document.getElementById('datapointsInput');

    let config;
    let pointsToShow;
    let activeComputer = localStorage.getItem('activeComputer') || 'Local';  
    let computers = [];

    // Initial fetch for configuration
    fetch('../webconfig.json')
        .then(response => response.json())
        .then(data => {
            config = data;
            pointsToShow = config.default_points_to_show || 10; // Use default value if not set in config
            fetchComputersAndConnect();
        })
        .catch(error => console.error('Error fetching configuration:', error));

    function fetchComputersAndConnect() {
        fetch('computers.json')
            .then(response => response.json())
            .then(data => {
                computers = data.computers;

                if (computers && Array.isArray(computers)) {
                    computers.forEach(computer => {
                        setupWebSocket(computer);
                    });

                    updateComputerTabs(computers);
                } else {
                    console.error("Invalid computers.json format.");
                }
            })
            .catch(error => console.error('Error fetching computers:', error));
    }

    function setupWebSocket(computer) {
        const url = `ws://${computer.ip}:${computer.port}/ws_history`;
        const socket = new WebSocket(url);

        socket.onmessage = function (event) {
            try {
                const data = JSON.parse(event.data);
                if (activeComputer === computer.name) {
                    handleHistoricalData(data);
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

    function handleHistoricalData(data) {
        const historicalData = data.historical_data;

        if (!historicalData || historicalData.length === 0) {
            throw new Error('No historical data available');
        }

        const timestamps = historicalData.map(entry => entry.timestamp);
        const cpuHistory = historicalData.map(entry => entry.cpu_history);
        const memoryHistory = historicalData.map(entry => entry.memory_history);

        const cpuChart = createChart(ctxCpu, 'CPU Usage (%)', timestamps, cpuHistory, 'rgb(75, 192, 192)');
        const memoryChart = createChart(ctxMemory, 'Memory Usage (%)', timestamps, memoryHistory, 'rgb(153, 102, 255)');

        initializeTimeSlider(timeSlider, timestamps.length, pointsToShow, (index) => {
            updateCharts(cpuChart, memoryChart, index, historicalData);
        });

        const currentTimeIndex = timestamps.length - 1;
        currentTimeField.textContent = `Current Time: ${timestamps[currentTimeIndex]}`;

        updateButton.addEventListener('click', function () {
            pointsToShow = parseInt(datapointsInput.value, 10) || pointsToShow;
            const sliderValue = parseInt(timeSlider.noUiSlider.get(), 10);
            updateCharts(cpuChart, memoryChart, sliderValue, historicalData);
        });
    }

    function createChart(ctx, label, labels, data, borderColor) {
        return new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: label,
                    data: data,
                    borderColor: borderColor,
                    fill: false
                }]
            },
            options: {
                animation: config.animations,
                responsive: true,
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            parser: 'MM/dd/yyyy HH:mm:ss',
                            tooltipFormat: 'MM/dd/yyyy HH:mm:ss',
                            unit: 'second'
                        },
                        ticks: {
                            source: 'labels'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
    }

    function initializeTimeSlider(slider, maxValue, startValue, onUpdate) {
        noUiSlider.create(slider, {
            start: maxValue - startValue,
            connect: [true, false],
            range: {
                'min': 0,
                'max': maxValue - 1
            },
            format: {
                to: value => Math.floor(value),
                from: value => Math.floor(value)
            }
        });

        slider.noUiSlider.on('update', function (values, handle) {
            const index = parseInt(values[handle], 10);
            onUpdate(index);
        });
    }

    function updateCharts(cpuChart, memoryChart, index, historicalData) {
        const totalPoints = historicalData.length;

        let startIndex = index;
        let endIndex = Math.min(startIndex + pointsToShow, totalPoints);

        const timestamps = historicalData.map(entry => entry.timestamp);
        const cpuHistory = historicalData.map(entry => entry.cpu_history);
        const memoryHistory = historicalData.map(entry => entry.memory_history);

        cpuChart.data.labels = timestamps.slice(startIndex, endIndex);
        cpuChart.data.datasets[0].data = cpuHistory.slice(startIndex, endIndex);

        memoryChart.data.labels = timestamps.slice(startIndex, endIndex);
        memoryChart.data.datasets[0].data = memoryHistory.slice(startIndex, endIndex);

        cpuChart.update();
        memoryChart.update();

        currentTimeField.textContent = `Current Time: ${timestamps[startIndex]}`;
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
        }
    });
});
