const maxDataPoints = 20; // Stel hier het maximum aantal datapunten in

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
                labels: [new Date().toLocaleTimeString()], // Initially only one data point
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
            labels: [new Date().toLocaleTimeString()], // Initially only one data point
            datasets: [{
                label: 'Average CPU Usage',
                data: [data.cpu_usage_avg],
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
                        text: 'Time'
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

    setInterval(updateData, 5000, averageCpuChart); // Update elke 5 seconden
}

function updateData(averageCpuChart) {
    fetchCpuData().then(data => {
        const now = new Date();
        const timestamp = now.toLocaleTimeString();
        
        // Voeg timestamp toe als een label aan elke core chart
        data.cpu_usage_per_core.forEach((usage, index) => {
            const chart = Chart.getChart(`coreChart${index}`);
            chart.data.labels.push(timestamp);
            chart.data.datasets[0].data.push(usage);

            // Verschuif grafieken als ze maxdatapoints bereiken
            if (chart.data.labels.length > maxDataPoints) {
                chart.data.labels.shift();
                chart.data.datasets[0].data.shift();
            }
            chart.update();
        });

        // Update gemiddelde CPU gebruik
        document.getElementById('cpu_usage').textContent = data.cpu_usage_avg.toFixed(1);

        // Voeg timestamp en data toe aan average CPU chart
        averageCpuChart.data.labels.push(timestamp);
        averageCpuChart.data.datasets[0].data.push(data.cpu_usage_avg);

        // Verschuif grafiek als deze maxdatapoints bereikt
        if (averageCpuChart.data.labels.length > maxDataPoints) {
            averageCpuChart.data.labels.shift();
            averageCpuChart.data.datasets[0].data.shift();
        }

        averageCpuChart.update();
    }).catch(error => {
        console.error('ERROR:', error);
    });
}

document.addEventListener('DOMContentLoaded', createCpuCharts);
