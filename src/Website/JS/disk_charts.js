document.addEventListener("DOMContentLoaded", function () {
    const maxDataPoints = 30;

    function initializeDiskCharts(diskData) {
        const container = document.getElementById('disks');
        container.innerHTML = '';

        if (!diskData || diskData.length === 0) {
            container.innerHTML = '<p>No disk data available.</p>';
            return;
        }

        diskData.forEach((disk, index) => {
            const diskDiv = document.createElement('div');
            diskDiv.classList.add('disk');

            const title = document.createElement('h3');
            title.textContent = `Disk: ${disk.device}`;
            diskDiv.appendChild(title);

            const readChartCanvas = document.createElement('canvas');
            readChartCanvas.id = `diskReadChart${index}`;
            diskDiv.appendChild(readChartCanvas);

            const writeChartCanvas = document.createElement('canvas');
            writeChartCanvas.id = `diskWriteChart${index}`;
            diskDiv.appendChild(writeChartCanvas);

            container.appendChild(diskDiv);

            const ctxRead = readChartCanvas.getContext('2d');
            const ctxWrite = writeChartCanvas.getContext('2d');

            const readChart = new Chart(ctxRead, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Read Bytes',
                        data: [],
                        borderColor: 'rgb(75, 192, 192)',
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

            const writeChart = new Chart(ctxWrite, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Write Bytes',
                        data: [],
                        borderColor: 'rgb(153, 102, 255)',
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

            setInterval(() => {
                fetch('/system_info')
                    .then(response => response.json())
                    .then(data => {
                        const now = new Date();
                        const timestamp = now.toLocaleTimeString();

                        const diskInfo = data.disk_infos[index];

                        if (!diskInfo) return;

                        readChart.data.labels.push(timestamp);
                        writeChart.data.labels.push(timestamp);

                        if (readChart.data.labels.length > maxDataPoints) {
                            readChart.data.labels.shift();
                            writeChart.data.labels.shift();
                            readChart.data.datasets[0].data.shift();
                            writeChart.data.datasets[0].data.shift();
                        }

                        readChart.data.datasets[0].data.push(diskInfo.read_bytes);
                        writeChart.data.datasets[0].data.push(diskInfo.write_bytes);

                        readChart.update();
                        writeChart.update();
                    })
                    .catch(error => console.error('Error fetching disk data:', error));
            }, 1000);
        });
    }

    fetch('/system_info')
        .then(response => response.json())
        .then(data => {
            initializeDiskCharts(data.disk_infos);
        })
        .catch(error => console.error('Error fetching initial disk data:', error));
});
