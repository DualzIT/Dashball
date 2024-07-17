document.addEventListener("DOMContentLoaded", function () {
    const maxDataPoints = 30;
    let diskCharts = {};
    let diskSpaceCharts = {};

    function initializeCharts(diskInfos) {
        diskInfos.forEach((disk, index) => {
            const readCtx = document.getElementById(`readSpeedChart${index}`).getContext('2d');
            const writeCtx = document.getElementById(`writeSpeedChart${index}`).getContext('2d');
            const spaceCtx = document.getElementById(`diskSpaceChart${index}`).getContext('2d');

            diskCharts[disk.device] = {
                readSpeed: new Chart(readCtx, {
                    type: 'line',
                    data: {
                        labels: [],
                        datasets: [{
                            label: `Read Speed (Bytes/s) - ${disk.device}`,
                            data: [],
                            borderColor: 'rgb(75, 192, 192)',
                        }]
                    },
                    options: {
                        scales: {
                            y: {
                                beginAtZero: true
                            }
                        }
                    }
                }),
                writeSpeed: new Chart(writeCtx, {
                    type: 'line',
                    data: {
                        labels: [],
                        datasets: [{
                            label: `Write Speed (Bytes/s) - ${disk.device}`,
                            data: [],
                            borderColor: 'rgb(153, 102, 255)',
                        }]
                    },
                    options: {
                        scales: {
                            y: {
                                beginAtZero: true
                            }
                        }
                    }
                })
            };

            diskSpaceCharts[disk.device] = new Chart(spaceCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Used Space (GB)', 'Free Space (GB)'],
                    datasets: [{
                        data: [disk.used_space, disk.free_space],
                        backgroundColor: ['#F9B94B', '#6FF36F'],
                        borderWidth: 0
                    }]
                }
            });
        });
    }

    function updateData() {
        fetch('/system_info')
            .then(response => response.json())
            .then(data => {
                const now = new Date();
                const timestamp = now.toLocaleTimeString();

                data.disk_infos.forEach((disk, index) => {
                    const charts = diskCharts[disk.device];
                    const spaceChart = diskSpaceCharts[disk.device];

                    if (charts && spaceChart) {
                        charts.readSpeed.data.labels.push(timestamp);
                        charts.writeSpeed.data.labels.push(timestamp);

                        if (charts.readSpeed.data.labels.length > maxDataPoints) {
                            charts.readSpeed.data.labels.shift();
                            charts.writeSpeed.data.labels.shift();
                            charts.readSpeed.data.datasets[0].data.shift();
                            charts.writeSpeed.data.datasets[0].data.shift();
                        }

                        charts.readSpeed.data.datasets[0].data.push(disk.read_speed);
                        charts.writeSpeed.data.datasets[0].data.push(disk.write_speed);

                        spaceChart.data.datasets[0].data = [disk.used_space, disk.free_space];

                        charts.readSpeed.update();
                        charts.writeSpeed.update();
                        spaceChart.update();

                        document.getElementById(`used_disk_gb${index}`).textContent = `${disk.used_space}GB`;
                        document.getElementById(`free_disk_gb${index}`).textContent = `${disk.free_space}GB`;
                        document.getElementById(`total_disk_gb${index}`).textContent = `${disk.total_space}GB`;
                    }
                });
            })
            .catch(error => {
                console.error('ERROR:', error);
            });
    }

    fetch('/system_info')
        .then(response => response.json())
        .then(data => {
            const diskContainer = document.getElementById('diskContainer');

            data.disk_infos.forEach((disk, index) => {
                const diskElement = `
                    <div class="disk-info">
                        <h2>${disk.device} - ${disk.mountpoint}</h2>
                        <div class="linegraph">
                            <canvas id="readSpeedChart${index}"></canvas>
                        </div>
                        <div class="linegraph">
                            <canvas id="writeSpeedChart${index}"></canvas>
                        </div>
                        <div class="linegraph">
                            <canvas id="diskSpaceChart${index}"></canvas>
                        </div>
                        <p>Used Space: <span id="used_disk_gb${index}">${disk.used_space}GB</span></p>
                        <p>Free Space: <span id="free_disk_gb${index}">${disk.free_space}GB</span></p>
                        <p>Total Space: <span id="total_disk_gb${index}">${disk.total_space}GB</span></p>
                    </div>
                `;
                diskContainer.insertAdjacentHTML('beforeend', diskElement);
            });

            initializeCharts(data.disk_infos);
            updateData();
            setInterval(updateData, 1000);
        })
        .catch(error => {
            console.error('ERROR:', error);
        });
});
