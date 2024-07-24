document.addEventListener("DOMContentLoaded", async function () {
    const maxDataPoints = 20;
    let chartToDelete = null;

    const chartConfigurations = {
        gpuUsage: {
            label: 'GPU Usage (%)',
            category: 'GPU',
            color: 'rgb(255, 99, 132)',
            yAxisMax: 100,
            fetchData: async () => (await fetchData('/system_info')).gpu_info.gpu0.utilization_gpu
        },
        gpuMemory: {
            label: 'GPU Memory (%)',
            category: 'GPU',
            color: 'rgb(75, 192, 192)',
            yAxisMax: 100,
            fetchData: async () => (await fetchData('/system_info')).gpu_info.gpu0.memory_used
        },
        gpuClockSpeed: {
            label: 'GPU Clock Speed (MHz)',
            category: 'GPU',
            color: 'rgb(153, 102, 255)',
            fetchData: async () => (await fetchData('/system_info')).gpu_info.gpu0.clock_speed
        },
        gpuMemoryClockSpeed: {
            label: 'GPU Memory Clock Speed (MHz)',
            category: 'GPU',
            color: 'rgb(255, 159, 64)',
            fetchData: async () => (await fetchData('/system_info')).gpu_info.gpu0.memory_clock_speed
        },
        gpuEncoder: {
            label: 'GPU Encoder Utilization (%)',
            category: 'GPU',
            color: 'rgb(54, 162, 235)',
            yAxisMax: 100,
            fetchData: async () => (await fetchData('/system_info')).gpu_info.gpu0.encoder_utilization
        },
        gpuDecoder: {
            label: 'GPU Decoder Utilization (%)',
            category: 'GPU',
            color: 'rgb(255, 205, 86)',
            yAxisMax: 100,
            fetchData: async () => (await fetchData('/system_info')).gpu_info.gpu0.decoder_utilization
        },
        cpuUsage: {
            label: 'CPU Usage (%)',
            category: 'CPU',
            color: 'rgba(75, 192, 192, 1)',
            yAxisMax: 100,
            fetchData: async () => (await fetchData('/system_info')).cpu_usage
        },
        cpuUsagepercore: {
            label: 'CPU Usage per Core (%)',
            category: 'CPU',
            color: 'rgba(75, 192, 192, 1)',
            yAxisMax: 100,
            fetchData: async () => (await fetchData('/system_info')).cpu_usage_per_core
        }
    };

    const disks = await fetchDisks();

    disks.forEach((disk, index) => {
        chartConfigurations[`diskReadSpeed_${disk.mountpoint}`] = {
            label: `Disk Read Speed (Bytes/s) - ${disk.mountpoint}`,
            category: 'Disk',
            color: 'rgb(75, 192, 255)',
            fetchData: async () => (await fetchData('/system_info')).disk_infos[index].read_speed
        };
        chartConfigurations[`diskWriteSpeed_${disk.mountpoint}`] = {
            label: `Disk Write Speed (Bytes/s) - ${disk.mountpoint}`,
            category: 'Disk',
            color: 'rgb(153, 102, 255)',
            fetchData: async () => (await fetchData('/system_info')).disk_infos[index].write_speed
        };
        chartConfigurations[`diskSpace_${disk.mountpoint}`] = {
            label: `Disk Space Usage (GB) - ${disk.mountpoint}`,
            category: 'Disk',
            type: 'doughnut',
            fetchData: async () => {
                const data = await fetchData('/system_info');
                return {
                    used: data.disk_infos[index].used_space / 1024,
                    free: data.disk_infos[index].free_space / 1024
                };
            }
        };
    });

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
            overlay.style.display = 'block';
        });

        closeOverlay.addEventListener('click', () => {
            overlay.style.display = 'none';
        });

        window.addEventListener('click', (event) => {
            if (event.target === overlay) {
                overlay.style.display = 'none';
            }
        });

        const categories = {
            GPU: document.createElement('div'),
            CPU: document.createElement('div'),
            Disk: document.createElement('div')
        };

        Object.keys(categories).forEach(category => {
            const header = document.createElement('h3');
            header.textContent = category;
            categories[category].appendChild(header);
            chartOptions.appendChild(categories[category]);
        });

        Object.keys(chartConfigurations).forEach(key => {
            const config = chartConfigurations[key];
            const chartOption = document.createElement('button');
            chartOption.textContent = config.label;
            chartOption.addEventListener('click', () => {
                addChart(config);
                overlay.style.display = 'none';
            });
            categories[config.category].appendChild(chartOption);
        });
    }

    function createChartOptions(config) {
        return {
            type: config.type || 'line',
            data: {
                labels: config.type === 'doughnut' ? ['Used Space (GB)', 'Free Space (GB)'] : [],
                datasets: [{
                    label: config.label,
                    data: [],
                    backgroundColor: config.type === 'doughnut' ? ['#F9B94B', '#6FF36F'] : undefined,
                    borderColor: config.color,
                    fill: config.type !== 'doughnut'
                }]
            },
            options: {
                scales: config.type === 'doughnut' ? {} : {
                    y: {
                        beginAtZero: true,
                        max: config.yAxisMax !== undefined ? config.yAxisMax : undefined
                    }
                },
                maintainAspectRatio: false
            }
        };
    }

    function addChart(config) {
        if (config.label === 'CPU Usage per Core (%)') {
            addCpuUsagePerCoreChart(config);
            return;
        }

        const chartItem = document.createElement('div');
        chartItem.className = 'grid-stack-item';

        const chartContent = document.createElement('div');
        chartContent.className = 'grid-stack-item-content';
        chartItem.appendChild(chartContent);

        const closeButton = document.createElement('span');
        closeButton.className = 'close-chart';
        closeButton.innerHTML = '&times;';
        closeButton.addEventListener('click', () => {
            showConfirmOverlay(chartItem);
        });
        chartItem.appendChild(closeButton);

        const canvas = document.createElement('canvas');
        chartContent.appendChild(canvas);

        grid.addWidget(chartItem, { width: 6, height: 4, autoPosition: true });

        const chartOptions = createChartOptions(config);
        const chart = new Chart(canvas, chartOptions);

        updateChart(chart, config.fetchData, config.type);

        // Adjust canvas resolution on resize
        adjustCanvasResolution(chartItem, chart);
        chartItem.addEventListener('resize', () => adjustCanvasResolution(chartItem, chart));
    }

    function addCpuUsagePerCoreChart(config) {
        const chartItem = document.createElement('div');
        chartItem.className = 'grid-stack-item';

        const chartContent = document.createElement('div');
        chartContent.className = 'grid-stack-item-content';
        chartContent.style.display = 'flex';
        chartContent.style.flexWrap = 'wrap';
        chartItem.appendChild(chartContent);

        const closeButton = document.createElement('span');
        closeButton.className = 'close-chart';
        closeButton.innerHTML = '&times;';
        closeButton.addEventListener('click', () => {
            showConfirmOverlay(chartItem);
        });
        chartItem.appendChild(closeButton);

        grid.addWidget(chartItem, { width: 12, height: 8, autoPosition: true });

        config.fetchData().then(coreUsages => {
            coreUsages.forEach((usage, index) => {
                const coreChartContainer = document.createElement('div');
                coreChartContainer.style.flex = '1 1 30%';
                coreChartContainer.style.margin = '10px';
                
                const canvas = document.createElement('canvas');
                coreChartContainer.appendChild(canvas);
                chartContent.appendChild(coreChartContainer);

                const chartOptions = createChartOptions({
                    ...config,
                    label: `Core ${index} Usage`
                });
                const chart = new Chart(canvas, chartOptions);

                updateChart(chart, () => Promise.resolve(usage), 'line');

                // Adjust canvas resolution on resize
                adjustCanvasResolution(chartItem, chart);
                chartItem.addEventListener('resize', () => adjustCanvasResolution(chartItem, chart));
            });
        });
    }

    async function fetchData(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return await response.json();
        } catch (error) {
            console.error('Fetch error:', error);
            throw error;
        }
    }

    async function fetchDisks() {
        try {
            const data = await fetchData('/system_info');
            return data.disk_infos;
        } catch (error) {
            console.error('Fetch disks error:', error);
            throw error;
        }
    }

    function updateChart(chart, fetchData, type) {
        setInterval(async () => {
            try {
                const data = await fetchData();
                const now = new Date();
                const timestamp = now.toLocaleTimeString();

                if (type === 'doughnut') {
                    chart.data.datasets[0].data = [data.used, data.free];
                } else {
                    if (chart.data.labels.length > maxDataPoints) {
                        chart.data.labels.shift();
                        chart.data.datasets[0].data.shift();
                    }

                    chart.data.labels.push(timestamp);
                    chart.data.datasets[0].data.push(data);
                }

                chart.update();
            } catch (error) {
                console.error('Update chart error:', error);
            }
        }, 1000);
    }

    function adjustCanvasResolution(chartItem, chart) {
        const canvas = chartItem.querySelector('canvas');
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = rect.height * window.devicePixelRatio;
        chart.resize();
    }

    function showConfirmOverlay(chartItem) {
        chartToDelete = chartItem;
        const confirmOverlay = document.getElementById('confirmOverlay');
        confirmOverlay.style.display = 'flex';

        document.getElementById('confirmDeleteButton').onclick = () => {
            grid.removeWidget(chartToDelete);
            confirmOverlay.style.display = 'none';
        };

        document.getElementById('cancelDeleteButton').onclick = () => {
            confirmOverlay.style.display = 'none';
        };
    }

    initializeOverlay();
});
