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
                const apps = data.running_apps;
                updateTable(apps);
            })
            .catch(error => console.error('Error fetching applications:', error));
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

            const iconPath = getIconPath(app.name);

            row.innerHTML = `
                <td class="processname"><img src="${iconPath}" alt="${app.name}" class="app-icon" onerror="this.onerror=null;this.src='icons/default.png';"> ${app.name}</td>
                <td>${app.pid}</td>
                <td>${app.cpu_percent.toFixed(2)}</td>
                <td>${(app.memory_info.rss / (1024 * 1024)).toFixed(2)} MB</td>
                <td>${(app.read_bytes / (1024 * 1024)).toFixed(2)} MB</td>
                <td>${(app.write_bytes / (1024 * 1024)).toFixed(2)} MB</td>
            `;

            tbody.appendChild(row);
        });

        updateSortIcons();
    }

    function getIconPath(processName) {
        if (!processName) {
            return "icons/default.png"; // Default icon path
        }

        // Convert process name to lowercase and add .png extension
        const iconName = processName.toLowerCase() + ".png";
        return "icons/" + iconName;
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

    table.querySelectorAll("th[data-sort]").forEach(th => {
        th.addEventListener("click", function() {
            const column = this.getAttribute("data-sort");
            if (sortColumn === column) {
                sortAscending = !sortAscending;
            } else {
                sortColumn = column;
                sortAscending = true;
            }
            fetchApplications();
            sortedByElem.textContent = `Sorted by: ${column} (${sortAscending ? "asc" : "desc"})`;
        });
    });

    fetchApplications();
    setInterval(fetchApplications, 5000); // Fetch applications data every 5 seconds
});
