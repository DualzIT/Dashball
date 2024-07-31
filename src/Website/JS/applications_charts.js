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

            row.innerHTML = `
                <td>${app.name}</td>
                <td>${app.pid}</td>
                <td>${app.cpu_percent.toFixed(2)}</td>
                <td>${app.memory_info.rss}</td>
                <td>${app.read_bytes}</td>
                <td>${app.write_bytes}</td>
            `;

            tbody.appendChild(row);
        });

        sortedByElem.textContent = capitalizeFirstLetter(sortColumn.replace("_", " "));
    }

    function capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    table.querySelectorAll("th").forEach(th => {
        th.addEventListener("click", () => {
            const newSortColumn = th.getAttribute("data-sort");
            if (newSortColumn === sortColumn) {
                sortAscending = !sortAscending;
            } else {
                sortColumn = newSortColumn;
                sortAscending = false;
            }
            fetchApplications();
        });
    });

    fetchApplications();
    setInterval(fetchApplications, 5000); // Refresh every 5 seconds
});
