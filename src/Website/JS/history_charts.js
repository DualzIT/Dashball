document.addEventListener("DOMContentLoaded", function () {
    const ctxCpu = document.getElementById('cpuChart').getContext('2d');
    const ctxMemory = document.getElementById('memoryChart').getContext('2d');
    const currentTimeField = document.getElementById('currentTime');
    const timeSlider = document.getElementById('timeSlider');
    const updateButton = document.getElementById('updateButton');
    const datapointsInput = document.getElementById('datapointsInput');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingMessage = document.getElementById('loadingMessage');

    let config;
    let pointsToShow;

    fetch('../webconfig.json')
        .then(response => response.json())
        .then(data => {
            config = data;
            pointsToShow = config.default_points_to_show || 10;
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

                const timestamps = historicalData.map(entry => entry.timestamp);
                const cpuHistory = historicalData.map(entry => entry.cpu_history);
                const memoryHistory = historicalData.map(entry => entry.memory_history);

                new Chart(ctxCpu, {
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

                new Chart(ctxMemory, {
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
                
                hideLoadingOverlay();
            })
            .catch(error => {
                console.error('Error fetching historical data:', error);
                loadingMessage.innerHTML = `<div style="color: red;">Failed to load historical data. Please try again later.</div>`;
            });
    }

    function hideLoadingOverlay() {
        loadingOverlay.style.display = 'none';
    }
});
