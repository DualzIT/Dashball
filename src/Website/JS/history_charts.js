document.addEventListener("DOMContentLoaded", function () {
    const ctxCpu = document.getElementById('cpuChart').getContext('2d');
    const ctxMemory = document.getElementById('memoryChart').getContext('2d');
    const currentTimeField = document.getElementById('currentTime');
    const timeSlider = document.getElementById('timeSlider');
    const updateButton = document.getElementById('updateButton');
    const datapointsInput = document.getElementById('datapointsInput');
    const computerTabs = document.getElementById('computer-tabs');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingMessage = document.getElementById('loadingMessage');

    let config;
    let pointsToShow;
    let computers = [];
    let activeComputer = localStorage.getItem('activeComputer') || 'Local';

    // Load the configuration and computers
    fetch('../webconfig.json')
        .then(response => response.json())
        .then(data => {
            config = data;
            pointsToShow = config.default_points_to_show || 10;
            loadComputers();
        })
        .catch(error => console.error('Error fetching configuration:', error));

    function loadComputers() {
        fetch('computers.json')
            .then(response => response.json())
            .then(data => {
                computers = data.computers || [];
                setupComputerTabs();
                if (activeComputer) {
                    if (activeComputer === 'Local') {
                        loadHistoricalData(activeComputer);
                    } else {
                        showUnavailableMessage();
                    }
                }
            })
            .catch(error => console.error('Error fetching computers:', error));
    }

    function setupComputerTabs() {
        computerTabs.innerHTML = '';

        computers.forEach(computer => {
            const tab = document.createElement('li');
            tab.textContent = computer.name;
            tab.classList.add('computer-tab');
            if (activeComputer === computer.name) {
                tab.classList.add('active');
            }
            tab.addEventListener('click', () => {
                if (activeComputer !== computer.name) {
                    activeComputer = computer.name;
                    localStorage.setItem('activeComputer', activeComputer);
                    if (activeComputer === 'Local') {
                        loadHistoricalData(computer.name);
                        updateActiveTab();
                        hideLoadingOverlay(); // Hide the overlay when data is loaded
                    } else {
                        showUnavailableMessage();
                    }
                }
            });
            computerTabs.appendChild(tab);
        });

        // Set default active computer if none selected
        if (!activeComputer && computers.length > 0) {
            activeComputer = computers[0].name;
            localStorage.setItem('activeComputer', activeComputer);
            if (activeComputer === 'Local') {
                loadHistoricalData(activeComputer);
                updateActiveTab();
            } else {
                showUnavailableMessage();
            }
        }
    }

    function updateActiveTab() {
        const tabs = document.querySelectorAll('.computer-tab');
        tabs.forEach(tab => {
            if (tab.textContent === activeComputer) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
    }

    function loadHistoricalData(computerName) {
        fetch(`/history?computer=${encodeURIComponent(computerName)}`)
            .then(response => response.json())
            .then(data => {
                const historicalData = data.historical_data;

                if (!historicalData || historicalData.length === 0) {
                    throw new Error('No historical data available');
                }

                const timestamps = historicalData.map(entry => entry.timestamp);
                const cpuHistory = historicalData.map(entry => entry.cpu_history);
                const memoryHistory = historicalData.map(entry => entry.memory_history);

                const cpuChart = new Chart(ctxCpu, {
                    type: 'line',
                    data: {
                        labels: timestamps,
                        datasets: [{
                            label: 'CPU Usage (%)',
                            data: cpuHistory,
                            borderColor: 'rgb(75, 192, 192)',
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

                const memoryChart = new Chart(ctxMemory, {
                    type: 'line',
                    data: {
                        labels: timestamps,
                        datasets: [{
                            label: 'Memory Usage (%)',
                            data: memoryHistory,
                            borderColor: 'rgb(153, 102, 255)',
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

                noUiSlider.create(timeSlider, {
                    start: timestamps.length - pointsToShow,
                    connect: [true, false],
                    range: {
                        'min': 0,
                        'max': timestamps.length - 1
                    },
                    format: {
                        to: value => Math.floor(value),
                        from: value => Math.floor(value)
                    }
                });

                timeSlider.noUiSlider.on('update', function (values, handle) {
                    const index = parseInt(values[handle], 10);
                    updateCharts(cpuChart, memoryChart, index, historicalData);
                });

                const currentTimeIndex = timestamps.length - 1;
                currentTimeField.textContent = `Current Time: ${timestamps[currentTimeIndex]}`;

                updateButton.addEventListener('click', function () {
                    pointsToShow = parseInt(datapointsInput.value) || pointsToShow;
                    updateCharts(cpuChart, memoryChart, timeSlider.noUiSlider.get(), historicalData);
                });

                hideLoadingOverlay(); // Hide the overlay after loading data
            })
            .catch(error => {
                console.error('Error fetching historical data:', error);
                loadingMessage.innerHTML = `<div style="color: red;">Failed to load historical data for ${computerName}. Please try again later.</div>`;
            });
    }

    function updateCharts(cpuChart, memoryChart, index, historicalData) {
        const totalPoints = historicalData.length;
        let startIndex = index;
        let endIndex = startIndex + pointsToShow;
        endIndex = endIndex > totalPoints ? totalPoints : endIndex;

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

    function showUnavailableMessage() {
        loadingMessage.innerHTML = `
            <div style="color: red;">History viewing for computers other than the local machine is currently unavailable.</div>
        `;
        loadingOverlay.style.display = 'flex';
    }

    function hideLoadingOverlay() {
        loadingOverlay.style.display = 'none';
    }
});
