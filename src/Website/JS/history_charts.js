document.addEventListener("DOMContentLoaded", function () {
    const ctxCpu = document.getElementById('cpuChart').getContext('2d');
    const ctxMemory = document.getElementById('memoryChart').getContext('2d');
    const currentTimeField = document.getElementById('currentTime');
    const timeSlider = document.getElementById('timeSlider');
    const updateButton = document.getElementById('updateButton');
    const datapointsInput = document.getElementById('datapointsInput');

    let config;
    let pointsToShow;

    fetch('../webconfig.json')
        .then(response => response.json())
        .then(data => {
            config = data;
            pointsToShow = config.default_points_to_show || 10; // Use default value if not set in config

            fetch('/history')
                .then(response => response.json())
                .then(data => {
                    const historicalData = data.historical_data; // Use the new historical data

                    if (!historicalData || historicalData.length === 0) {
                        throw new Error('No historical data available');
                    }

                    // Extract timestamps, CPU history, and memory history
                    const timestamps = historicalData.map(entry => entry.timestamp);
                    const cpuHistory = historicalData.map(entry => entry.cpu_history);
                    const memoryHistory = historicalData.map(entry => entry.memory_history);

                    // CPU Chart
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
                                        parser: 'MM/dd/yyyy HH:mm:ss', // Custom format
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

                    // Memory Chart
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
                                        parser: 'MM/dd/yyyy HH:mm:ss', // Custom format
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

                    // Initialize noUiSlider
                    noUiSlider.create(timeSlider, {
                        start: timestamps.length - pointsToShow,
                        connect: [true, false],
                        range: {
                            'min': 0,
                            'max': timestamps.length - 1
                        },
                        format: {
                            to: function (value) {
                                return Math.floor(value);
                            },
                            from: function (value) {
                                return Math.floor(value);
                            }
                        }
                    });

                    timeSlider.noUiSlider.on('update', function (values, handle) {
                        const index = parseInt(values[handle], 10);
                        updateCharts(cpuChart, memoryChart, index, historicalData);
                    });

                    const currentTimeIndex = timestamps.length - 1;
                    currentTimeField.textContent = `Current Time: ${timestamps[currentTimeIndex]}`;

                    // Update button click event
                    updateButton.addEventListener('click', function () {
                        pointsToShow = parseInt(datapointsInput.value);
                        updateCharts(cpuChart, memoryChart, timeSlider.noUiSlider.get(), historicalData);
                    });
                })
                .catch(error => console.error('Error fetching historical data:', error));
        })
        .catch(error => console.error('Error fetching configuration:', error));

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
});
