document.addEventListener("DOMContentLoaded", function () {
    let diskCharts = {};
    let diskSpaceCharts = {};
    let config;
    let activeComputer = localStorage.getItem('activeComputer') || 'Local';  
    let computers = [];

    function createCanvasElement(index, label) {
        const canvas = document.createElement('canvas');
        canvas.id = `${label}Chart${index}`;
        return canvas;
    }

    function initializeCharts(diskInfos) {
        if (!diskInfos || !Array.isArray(diskInfos)) {
            console.error("disk_infos is either missing or not an array. Received data: ", diskInfos);
            return;
        }

        const diskContainer = document.getElementById('diskContainer');
        diskContainer.innerHTML = '';  // Clear the existing disk elements

        diskInfos.forEach((disk, index) => {
            const diskElement = document.createElement('div');
            diskElement.classList.add('disk-info');

            const readCanvas = createCanvasElement(index, 'readSpeed');
            const writeCanvas = createCanvasElement(index, 'writeSpeed');
            const spaceCanvas = createCanvasElement(index, 'diskSpace');

            diskElement.innerHTML = `
                <div class="disk-graphs">
                    <div>
                        <h2>Device: ${disk.device}</h2>
                        <h3>Mountpoint: ${disk.mountpoint}</h3>
                        <h3>Type: ${disk.fstype}</h3>
                    </div>
                    <div>
                        ${readCanvas.outerHTML}
                    </div>
                    <div>
                        ${writeCanvas.outerHTML}
                    </div>
                    <div>
                        <div class="diskspacechart">
                            ${spaceCanvas.outerHTML}
                            <p>Used Space: <span id="used_disk_gb${index}">${(disk.used_space / 1024).toFixed(2)} GB</span></p>
                            <p>Free Space: <span id="free_disk_gb${index}">${(disk.free_space / 1024).toFixed(2)} GB</span></p>
                            <p>Total Space: <span id="total_disk_gb${index}">${(disk.total_space / 1024).toFixed(2)} GB</span></p>
                        </div>
                    </div>
                </div>
            `;

            diskContainer.appendChild(diskElement);

            adjustCanvasResolution(readCanvas);
            adjustCanvasResolution(writeCanvas);
            adjustCanvasResolution(spaceCanvas);

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
                            borderColor: 'rgb(75, 192, 255)',
                        }]
                    },
                    options: {
                        animation: config.animations,
                        responsive: true,
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
                        animation: config.animations,
                        responsive: true,
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
                        data: [disk.used_space / 1024, disk.free_space / 1024], // Convert MB to GB
                        backgroundColor: ['#F9B94B', '#6FF36F'],
                        borderWidth: 0
                    }]
                },
                options: {
                    animation: config.animations,
                    responsive: true
                }
            });
        });
    }

    function adjustCanvasResolution(canvas) {
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = rect.height * window.devicePixelRatio;
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
    }

    function updateDataWithWebSocket(data) {
        if (!Array.isArray(data.disk_infos)) {
            console.error("disk_infos is either missing or not an array.");
            return;
        }

        const now = new Date();
        const timestamp = now.toLocaleTimeString();

        data.disk_infos.forEach((disk, index) => {
            const charts = diskCharts[disk.device];
            const spaceChart = diskSpaceCharts[disk.device];

            if (charts && spaceChart) {
                charts.readSpeed.data.labels.push(timestamp);
                charts.writeSpeed.data.labels.push(timestamp);

                if (charts.readSpeed.data.labels.length > config.max_data_points) {
                    charts.readSpeed.data.labels.shift();
                    charts.writeSpeed.data.labels.shift();
                    charts.readSpeed.data.datasets[0].data.shift();
                    charts.writeSpeed.data.datasets[0].data.shift();
                }

                charts.readSpeed.data.datasets[0].data.push(disk.read_speed);
                charts.writeSpeed.data.datasets[0].data.push(disk.write_speed);

                spaceChart.data.datasets[0].data = [disk.used_space / 1024, disk.free_space / 1024]; // Convert MB to GB

                charts.readSpeed.update();
                charts.writeSpeed.update();
                spaceChart.update();

                document.getElementById(`used_disk_gb${index}`).textContent = `${(disk.used_space / 1024).toFixed(2)} GB`;
                document.getElementById(`free_disk_gb${index}`).textContent = `${(disk.free_space / 1024).toFixed(2)} GB`;
                document.getElementById(`total_disk_gb${index}`).textContent = `${(disk.total_space / 1024).toFixed(2)} GB`;
            } else {
                console.error(`No charts found for disk device ${disk.device}.`);
            }
        });
    }

    function connectWebSocket(computer) {
        const url = `ws://${computer.ip}:${computer.port}/ws`;
        console.log(`Connecting to WebSocket at: ${url}`);
        const socket = new WebSocket(url);

        socket.onmessage = function (event) {
            try {
                const data = JSON.parse(event.data);
                console.log(`Received WebSocket data from ${computer.name}: `, data);
                if (activeComputer === computer.name) {
            
                    if (Object.keys(diskCharts).length === 0) {
                        initializeCharts(data.disk_infos);
                    }
                    updateDataWithWebSocket(data);
                }
            } catch (error) {
                console.error("Error processing WebSocket message:", error);
            }
        };

        socket.onerror = function (error) {
            console.error("WebSocket error for " + computer.name + ": ", error);
        };

        socket.onclose = function () {
            console.log("WebSocket connection closed for " + computer.name + ". Reconnecting in 1 second...");
            setTimeout(() => connectWebSocket(computer), 1000); // Reconnect on close
        };
    }

    function fetchComputersAndConnect() {
        fetch('computers.json')
            .then(response => {
                if (!response.ok) {
                    throw new Error("Failed to fetch computers.json");
                }
                return response.json();
            })
            .then(data => {
                computers = data.computers;

                
                computers.forEach(computer => {
                    connectWebSocket(computer);
                });

              
                const tabsContainer = document.getElementById('computer-tabs');
                tabsContainer.innerHTML = '';  
                computers.forEach(computer => {
                    const tab = document.createElement('li');
                    tab.setAttribute('data-computer-name', computer.name);
                    tab.textContent = computer.name;
                    if (computer.name === activeComputer) {
                        tab.classList.add('active');
                    }
                    tabsContainer.appendChild(tab);
                });
            })
            .catch(error => {
                console.error('ERROR:', error);
            });
    }

    document.getElementById('computer-tabs').addEventListener('click', function (event) {
        if (event.target.tagName === 'LI') {
            const selectedTab = event.target;
            activeComputer = selectedTab.getAttribute('data-computer-name');
            localStorage.setItem('activeComputer', activeComputer);  
            document.querySelectorAll('#computer-tabs li').forEach(tab => tab.classList.remove('active'));
            selectedTab.classList.add('active');

            // Clear charts when switching tabs
            diskCharts = {};  // Clear existing charts so they will be re-initialized
            diskSpaceCharts = {}; // Clear space charts as well

            const diskContainer = document.getElementById('diskContainer');
            diskContainer.innerHTML = '';  // Clear the existing disk elements
        }
    });

    fetch('../webconfig.json')
        .then(response => response.json())
        .then(data => {
            config = data;
            fetchComputersAndConnect();
        })
        .catch(error => {
            console.error('Error fetching configuration:', error);
        });
});
