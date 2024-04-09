document.addEventListener("DOMContentLoaded", function () {
    const ctxCpu = document.getElementById('cpuChart').getContext('2d');
    const ctxMemory = document.getElementById('memoryChart').getContext('2d');
    const currentTimeField = document.getElementById('currentTime');

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

            // Time Slider
            const timeSlider = document.getElementById('timeSlider');

            // Initialize noUiSlider
            noUiSlider.create(timeSlider, {
                start: timestamps.length - 10, // Start value to display the last 30 data points
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
        })
        .catch(error => console.error('Error fetching historical data:', error));

    function updateCharts(cpuChart, memoryChart, index, historicalData) {
        const totalPoints = historicalData.length;
        const pointsToShow = 10;

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
