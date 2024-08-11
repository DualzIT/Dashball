document.addEventListener("DOMContentLoaded", function() {
    const table = document.getElementById("applicationsTable");
    const tbody = table.querySelector("tbody");
    const sortedByElem = document.getElementById("sortedBy");
    let sortColumn = "cpu_percent";
    let sortAscending = false;
    let activeComputer = 'Local';
    let computers = [];

    function fetchApplications(data) {
        const apps = data.running_apps;
        updateTable(apps);
    }

    function updateTable(apps) {
        tbody.innerHTML = "";

        const sortedApps = apps.sort((a, b) => {
            let aValue = a[sortColumn];
            let bValue = b[sortColumn];

            if (typeof aValue === "object") {
                aValue = aValue.rss || 0; // Default to RSS memory usage
                bValue = bValue.rss || 0;
            }

            if (sortAscending) {
                return aValue > bValue ? 1 : -1;
            } else {
                return aValue < bValue ? 1 : -1;
            }
        });

        sortedApps.forEach(app => {
            const row = document.createElement("tr");

            const appName = removeExeExtension(app.name);
            const iconPath = getIconPath(appName);

            row.innerHTML = `
                <td class="processname"><img src="${iconPath}" alt="${appName}" class="app-icon" onerror="this.onerror=null;this.src='icons/default.png';"> ${appName}</td>
                <td>${app.pid}</td>
                <td>${app.cpu_percent.toFixed(2)}</td>
                <td>${(app.memory_info.rss / (1024 * 1024)).toFixed(0)}</td>
                <td>${(app.read_bytes / (1024 * 1024)).toFixed(0)}</td>
                <td>${(app.write_bytes / (1024 * 1024)).toFixed(0)}</td>
            `;

            tbody.appendChild(row);
        });

        updateSortIcons();
    }

    function getIconPath(processName) {
        if (!processName) {
            return "icons/default.png"; // Default icon path
        }

        const iconName = processName.toLowerCase() + ".png";
        return "icons/" + iconName;
    }

    function removeExeExtension(name) {
        if (name.toLowerCase().endsWith(".exe")) {
            return name.slice(0, -4);
        }
        return name;
    }

    function updateSortIcons() {
        table.querySelectorAll("th[data-sort]").forEach(th => {
            th.classList.remove("sort-asc", "sort-desc");
            const column = th.getAttribute("data-sort");
            if (column === sortColumn) {
                th.classList.add(sortAscending ? "sort-asc" : "sort-desc");
            }
        });
    }

    function connectWebSocket(computer) {
        const url = `ws://${computer.ip}:${computer.port}/ws`;
        console.log(`Connecting to WebSocket at: ${url}`);
        const socket = new WebSocket(url);

        socket.onmessage = function(event) {
            try {
                const data = JSON.parse(event.data);
                console.log(`Received WebSocket data from ${computer.name}: `, data);
                if (activeComputer === computer.name) {
                    fetchApplications(data);
                }
            } catch (error) {
                console.error("Error processing WebSocket message:", error);
            }
        };

        socket.onerror = function(error) {
            console.error("WebSocket error for " + computer.name + ": ", error);
        };

        socket.onclose = function() {
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

                // Update the tabs UI
                const tabsContainer = document.getElementById('computer-tabs');
                tabsContainer.innerHTML = '';  // Clear existing tabs to avoid duplicates
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

    table.querySelectorAll("th[data-sort]").forEach(th => {
        th.addEventListener("click", function() {
            const column = this.getAttribute("data-sort");
            if (sortColumn === column) {
                sortAscending = !sortAscending;
            } else {
                sortColumn = column;
                sortAscending = true;
            }
            fetchApplications();  // Fetch data again after sorting
            sortedByElem.textContent = `Sorted by: ${column} (${sortAscending ? "asc" : "desc"})`;
        });
    });

    document.getElementById('computer-tabs').addEventListener('click', function(event) {
        if (event.target.tagName === 'LI') {
            const selectedTab = event.target;
            activeComputer = selectedTab.getAttribute('data-computer-name');
            document.querySelectorAll('#computer-tabs li').forEach(tab => tab.classList.remove('active'));
            selectedTab.classList.add('active');

            // Clear the table when switching tabs
            tbody.innerHTML = "";
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
