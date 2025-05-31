document.addEventListener("DOMContentLoaded", function () {
    const ctxCpu = document.getElementById('cpuChart').getContext('2d');
    const ctxMemory = document.getElementById('memoryChart').getContext('2d');
    const currentTimeField = document.getElementById('currentTime');
    const timeSlider = document.getElementById('timeSlider');
    const datapointsInput = document.getElementById('datapointsInput');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingMessage = document.getElementById('loadingMessage');

    let config;
    let allTimestamps = [];
    let allCpuHistory = [];
    let allMemoryHistory = [];
    let cpuChart, memoryChart;

    fetch('config.json')
        .then(response => response.json())
        .then(data => {
            config = data;
            loadHistoricalData();
        })
        .catch(error => console.error('Error fetching configuration:', error));

    function loadHistoricalData() {
        fetch('/history')
            .then(response => response.json())
            .then(data => {
                const historicalData = data.historical_data;
                if (!historicalData || historicalData.length === 0) {
                    throw new Error('No historical data available');
                }

                allTimestamps = historicalData.map(entry => entry.timestamp);
                allCpuHistory = historicalData.map(entry => entry.cpu_history);
                allMemoryHistory = historicalData.map(entry => entry.memory_history);

                // Init slider
                timeSlider.max = allTimestamps.length - 1;
                timeSlider.value = allTimestamps.length - 1;
                datapointsInput.value = config.default_points_to_show || 10;
                timeSlider.noUiSlider = noUiSlider.create(timeSlider, {
                    start: [allTimestamps.length - 1],
                    range: {
                        'min': 0,
                        'max': allTimestamps.length - 1
                    },
                    step: 1,
                    format: {
                        to: value => value.toFixed(0),
                        from: value => parseFloat(value)
                    }
                });
                timeSlider.noUiSlider.on('update', updateCharts);
                datapointsInput.addEventListener('input', updateCharts);
                updateCharts();
                hideLoadingOverlay();
            })
            .catch(error => {
                console.error('Error fetching historical data:', error);
                loadingMessage.innerHTML = `<div style="color: red;">Failed to load historical data. Please try again later.</div>`;
            });
    }

    function updateCharts() {
        const points = parseInt(datapointsInput.value) || 10;
        const end = parseInt(timeSlider.noUiSlider.get()) + 1;
        const start = Math.max(0, end - points);

        const timestamps = allTimestamps.slice(start, end);
        const cpuHistory = allCpuHistory.slice(start, end);
        const memoryHistory = allMemoryHistory.slice(start, end);

        currentTimeField.textContent = timestamps[timestamps.length - 1] || '';

        // Init charts als ze nog niet bestaan
        if (!cpuChart) {
            cpuChart = new Chart(ctxCpu, {
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
                    animation: false,
                    responsive: true,
                    scales: {
                        x: {
                            type: 'time',
                            time: {
                                parser: 'MM/dd/yyyy HH:mm:ss',
                                tooltipFormat: 'MM/dd/yyyy HH:mm:ss',
                                unit: 'second'
                            },
                            ticks: { source: 'labels' }
                        },
                        y: { beginAtZero: true, max: 100 }
                    }
                }
            });
        } else {
            cpuChart.data.labels = timestamps;
            cpuChart.data.datasets[0].data = cpuHistory;
            cpuChart.update();
        }

        if (!memoryChart) {
            memoryChart = new Chart(ctxMemory, {
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
                    animation: false,
                    responsive: true,
                    scales: {
                        x: {
                            type: 'time',
                            time: {
                                parser: 'MM/dd/yyyy HH:mm:ss',
                                tooltipFormat: 'MM/dd/yyyy HH:mm:ss',
                                unit: 'second'
                            },
                            ticks: { source: 'labels' }
                        },
                        y: { beginAtZero: true, max: 100 }
                    }
                }
            });
        } else {
            memoryChart.data.labels = timestamps;
            memoryChart.data.datasets[0].data = memoryHistory;
            memoryChart.update();
        }
    }
});
