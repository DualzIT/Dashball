const maxDataPoints = 20;  

async function fetchCpuData() {
    const response = await fetch('/system_info');
    const data = await response.json();
    return data;
}

async function createCpuCharts() {
    const data = await fetchCpuData();
    const chartsContainer = document.getElementById('chartsContainer');

    data.cpu_usage_per_core.forEach((usage, index) => {
        const container = document.createElement('div');
        container.className = 'cpu-linegraph';
        
        const canvas = document.createElement('canvas');
        canvas.id = `coreChart${index}`;
        container.appendChild(canvas);
        chartsContainer.appendChild(container);

        new Chart(canvas, {
            type: 'line',
            data: {
                labels: [new Date().toLocaleTimeString()], 
                datasets: [{
                    label: `Core ${index} Usage`,
                    data: [usage],
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1,
                    fill: false
                }]
            },
            options: {
                scales: {
                    x: {
                        title: {
                            display: true,
                           
                        }
                    },
                    y: {
                        beginAtZero: true,
                        max: 100,
                        title: {
                            display: true,
                            text: 'CPU Usage (%)'
                        }
                    }
                }
            }
        });
    });

    const averageCpuCanvas = document.getElementById('averageCpuChart');
    const averageCpuChart = new Chart(averageCpuCanvas, {
        type: 'line',
        data: {
            labels: [new Date().toLocaleTimeString()], 
            datasets: [{
                label: 'Average CPU Usage',
                data: [data.cpu_usage],
                borderColor: 'rgba(255, 99, 132, 1)',
                borderWidth: 1,
                fill: false
            }]
        },
        options: {
            scales: {
                x: {
                    title: {
                        display: true,
                     
                    }
                },
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: 'CPU Usage (%)'
                    }
                }
            }
        }
    });

   

    const ctxSwitchCanvas = document.getElementById('ctxSwitchChart');
    const ctxSwitchChart = new Chart(ctxSwitchCanvas, {
        type: 'line',
        data: {
            labels: [new Date().toLocaleTimeString()],
            datasets: [{
                label: 'Context Switches',
                data: [data.context_switches],
                borderColor: 'rgba(153, 102, 255, 1)',
                borderWidth: 1,
                fill: false
            }]
        },
        options: {
            scales: {
                x: {
                    title: {
                        display: true,
                     
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Context Switches'
                    }
                }
            }
        }
    });

    // Start updating data with interval from config
    const updateInterval = data.update_interval_seconds * 1000; 
    setInterval(() => updateData(averageCpuChart,  ctxSwitchChart), updateInterval);

    // Update CPU information section
    document.getElementById('cpu_name').textContent = `${data.cpu_info.name}`;
    document.getElementById('cpu_temperature').textContent = `${data.cpu_info.temperature} °C`;
    document.getElementById('cpu_frequency').textContent = `${data.cpu_info.frequency}MHz`;
    document.getElementById('cpu_cores').textContent = `${data.cpu_info.cores}`;
    document.getElementById('cpu_uptime').textContent = `${data.cpu_info.uptime}`;
    document.getElementById('cpu_threads').textContent = `${data.cpu_info.threads}`;

}

function updateData(averageCpuChart, ctxSwitchChart) {
    fetchCpuData().then(data => {
        const now = new Date();
        const timestamp = now.toLocaleTimeString();
        
        // Update per-core CPU usage charts
        data.cpu_usage_per_core.forEach((usage, index) => {
            const chart = Chart.getChart(`coreChart${index}`);
            chart.data.labels.push(timestamp);
            chart.data.datasets[0].data.push(usage);

            // Shift charts if they reach maxDataPoints
            if (chart.data.labels.length > maxDataPoints) {
                chart.data.labels.shift();
                chart.data.datasets[0].data.shift();
            }
            chart.update();
        });

        // Update average CPU usage chart
        averageCpuChart.data.labels.push(timestamp);
        averageCpuChart.data.datasets[0].data.push(data.cpu_usage);
        if (averageCpuChart.data.labels.length > maxDataPoints) {
            averageCpuChart.data.labels.shift();
            averageCpuChart.data.datasets[0].data.shift();
        }
        averageCpuChart.update();

       

        // Update context switches chart
        ctxSwitchChart.data.labels.push(timestamp);
        ctxSwitchChart.data.datasets[0].data.push(data.context_switches);
        if (ctxSwitchChart.data.labels.length > maxDataPoints) {
            ctxSwitchChart.data.labels.shift();
            ctxSwitchChart.data.datasets[0].data.shift();
        }
        ctxSwitchChart.update();

        // Update CPU information section
        const cpuUsageElement = document.getElementById('cpu_usage');
        if (cpuUsageElement) {
            cpuUsageElement.textContent = data.cpu_usage.toFixed(1);
        }
        const cpuNameElement = document.getElementById('cpu_name');
        if (cpuNameElement) {
            cpuNameElement.textContent = data.cpu_info.name;
        }
        const cpuTemperatureElement = document.getElementById('cpu_temperature');
        if (cpuTemperatureElement) {
            cpuTemperatureElement.textContent = data.cpu_info.temperature + '°C';
        }
        const cpuFrequencyElement = document.getElementById('cpu_frequency');
        if (cpuFrequencyElement) {
            cpuFrequencyElement.textContent = data.cpu_info.frequency + ' MHz';
        }
        const cpuCoresElement = document.getElementById('cpu_cores');
        if (cpuCoresElement) {
            cpuCoresElement.textContent = data.cpu_info.cores;
        }
        const cpuUptimeElement = document.getElementById('cpu_uptime');
        if (cpuUptimeElement) {
            cpuUptimeElement.textContent = data.cpu_info.uptime;
        }
        const cpuThreadsElement = document.getElementById('cpu_threads');
        if (cpuThreadsElement) {
            cpuThreadsElement.textContent = data.cpu_info.threads;
        }
    }).catch(error => {
        console.error('ERROR:', error);
    });
}

document.addEventListener('DOMContentLoaded', createCpuCharts);
