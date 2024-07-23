document.addEventListener("DOMContentLoaded", function () {
    const maxDataPoints = 20;

    const chartConfigurations = {
        cpuUsage: {
            label: 'CPU Usage (%)',
            color: 'rgba(75, 192, 192, 1)',
            fetchData: () => fetch('/system_info').then(response => response.json()).then(data => data.cpu_usage)
        },
        diskUsage: {
            label: 'Disk Usage (Bytes/s)',
            color: 'rgba(153, 102, 255, 1)',
            fetchData: () => fetch('/system_info').then(response => response.json()).then(data => data.disk_infos[0].read_speed)
        },
        gpuUsage: {
            label: 'GPU Usage (%)',
            color: 'rgba(255, 99, 132, 1)',
            fetchData: () => fetch('/system_info').then(response => response.json()).then(data => data.gpu_usage)
        },
        networkUsage: {
            label: 'Network Usage (Bytes/s)',
            color: 'rgba(54, 162, 235, 1)',
            fetchData: () => fetch('/system_info').then(response => response.json()).then(data => data.network_usage)
        }
    };

    const grid = GridStack.init({
        cellHeight: 100,
        minRow: 1,
        float: true,
    });

    function initializeOverlay() {
        const overlay = document.getElementById('chartOverlay');
        const closeOverlay = document.getElementById('closeOverlay');
        const chartOptions = document.getElementById('chartOptions');
        const addChartButton = document.getElementById('addChartButton');

        addChartButton.addEventListener('click', () => {
            console.log("Add Chart Button Clicked");
            overlay.style.display = 'block';
        });

        closeOverlay.addEventListener('click', () => {
            console.log("Close Overlay Clicked");
            overlay.style.display = 'none';
        });

        window.addEventListener('click', (event) => {
            if (event.target === overlay) {
                console.log("Overlay Background Clicked");
                overlay.style.display = 'none';
            }
        });

        Object.keys(chartConfigurations).forEach(key => {
            const chartOption = document.createElement('button');
            chartOption.textContent = chartConfigurations[key].label;
            chartOption.addEventListener('click', () => {
                console.log(`${chartConfigurations[key].label} Button Clicked`);
                addChart(chartConfigurations[key]);
                overlay.style.display = 'none';
            });
            chartOptions.appendChild(chartOption);
        });
    }

    function addChart(config) {
        const chartItem = document.createElement('div');
        chartItem.className = 'grid-stack-item';

        const chartContent = document.createElement('div');
        chartContent.className = 'grid-stack-item-content';
        chartItem.appendChild(chartContent);

        const canvas = document.createElement('canvas');
        chartContent.appendChild(canvas);

        // Add the chartItem to GridStack with specific width and height
        grid.addWidget(chartItem, { width: 6, height: 4, autoPosition: true });

        const chart = new Chart(canvas, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: config.label,
                    data: [],
                    fill: false,
                    borderColor: config.color,
                }]
            },
            options: {
                scales: {
                    y: {
                        beginAtZero: true,
                    }
                }
            }
        });

        updateChart(chart, config.fetchData);
    }

    function updateChart(chart, fetchData) {
        setInterval(() => {
            fetchData().then(data => {
                const now = new Date();
                const timestamp = now.toLocaleTimeString();

                if (chart.data.labels.length > maxDataPoints) {
                    chart.data.labels.shift();
                    chart.data.datasets[0].data.shift();
                }

                chart.data.labels.push(timestamp);
                chart.data.datasets[0].data.push(data);

                chart.update();
            });
        }, 1000);
    }

    initializeOverlay();
});
