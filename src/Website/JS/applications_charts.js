document.addEventListener("DOMContentLoaded", function() {
    const table = document.getElementById("applicationsTable");
    const tbody = table.querySelector("tbody");
    const sortedByElem = document.getElementById("sortedBy");
    let sortColumn = "cpu_percent";
    let sortAscending = false;

    function fetchApplications() {
        fetch('/system_info')
            .then(response => response.json())
            .then(data => {
                updateTable(data.running_apps);
            })
            .catch(error => console.error('Error fetching application data:', error));
    }

    function updateTable(apps) {
        tbody.innerHTML = "";

        const sortedApps = apps.sort((a, b) => {
            let aValue = a[sortColumn];
            let bValue = b[sortColumn];

            if (typeof aValue === "object") {
                aValue = aValue.rss || 0;
                bValue = bValue.rss || 0;
            }

            return sortAscending ? aValue - bValue : bValue - aValue;
        });

        sortedApps.forEach(app => {
            const row = document.createElement("tr");
            const appName = removeExeExtension(app.name);
            const iconPath = getIconPath(appName);

            row.innerHTML = `
                <td class="processname">
                    <img src="${iconPath}" alt="${appName}" class="app-icon" onerror="this.onerror=null;this.src='icons/default.png';">
                    ${truncateAppName(appName, 25)}
                </td>
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
        return processName ? `icons/${processName.toLowerCase()}.png` : "icons/default.png";
    }

    function removeExeExtension(name) {
        return name.toLowerCase().endsWith(".exe") ? name.slice(0, -4) : name;
    }

    function truncateAppName(name, maxLength) {
        return name.length > maxLength ? name.substring(0, maxLength) : name;
    }

    function updateSortIcons() {
        table.querySelectorAll("th[data-sort]").forEach(th => {
            th.classList.remove("sort-asc", "sort-desc");
            if (th.getAttribute("data-sort") === sortColumn) {
                th.classList.add(sortAscending ? "sort-asc" : "sort-desc");
            }
        });
    }

    function startLiveUpdate(interval = 5000) {
        setInterval(fetchApplications, interval);
    }

    fetch('webconfig.json')
        .then(response => response.json())
        .then(() => {
            fetchApplications();
            startLiveUpdate();
        })
        .catch(error => console.error('Error fetching configuration:', error));

    table.querySelectorAll("th[data-sort]").forEach(th => {
        th.addEventListener("click", function() {
            const column = this.getAttribute("data-sort");
            sortAscending = sortColumn === column ? !sortAscending : true;
            sortColumn = column;
            fetchApplications();
            sortedByElem.textContent = `Sorted by: ${column} (${sortAscending ? "asc" : "desc"})`;
        });
    });
});
