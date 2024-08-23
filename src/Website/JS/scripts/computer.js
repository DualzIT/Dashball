let activeComputer = localStorage.getItem('activeComputer') || 'Local';  
let computers = [];
let config;

function connectWebSocket(computer, onMessageCallback) {
    const url = `ws://${computer.ip}:${computer.port}/ws`;
    console.log(`Connecting to WebSocket at ${url} for computer: ${computer.name}`);

    const socket = new WebSocket(url);

    socket.onmessage = function (event) {
        try {
            const data = JSON.parse(event.data);

            if (computer.name !== activeComputer) {
                console.log(`Received data for ${computer.name}, but ${activeComputer} is active. Ignoring.`);
                return;
            }

            console.log(`Processing data for active computer: ${computer.name}`);
            onMessageCallback(data);
        } catch (error) {
            console.error("Error processing WebSocket message:", error);
        }
    };

    socket.onerror = function (error) {
        console.error("WebSocket error: ", error);
    };

    socket.onclose = function () {
        console.log("WebSocket connection closed. Reconnecting in 1 second...");
        setTimeout(() => connectWebSocket(computer, onMessageCallback), 1000); // Reconnect on close
    };
}

function fetchComputersAndConnect(onMessageCallback) {
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
                connectWebSocket(computer, onMessageCallback);
            });

            updateComputerTabs();
        })
        .catch(error => {
            console.error('ERROR:', error);
        });
}

function updateComputerTabs() {
    const tabsContainer = document.getElementById('computer-tabs');
    tabsContainer.innerHTML = ''; // Clear existing tabs
    computers.forEach(computer => {
        const tab = document.createElement('li');
        tab.setAttribute('data-computer-name', computer.name);
        tab.textContent = computer.name;
        if (computer.name === activeComputer) {
            tab.classList.add('active');
        }
        tabsContainer.appendChild(tab);
    });
}

document.getElementById('computer-tabs').addEventListener('click', function (event) {
    if (event.target.tagName === 'LI') {
        const selectedTab = event.target;
        const newActiveComputer = selectedTab.getAttribute('data-computer-name');
        if (newActiveComputer !== activeComputer) {
            activeComputer = newActiveComputer;
            localStorage.setItem('activeComputer', activeComputer);  
            document.querySelectorAll('#computer-tabs li').forEach(tab => tab.classList.remove('active'));
            selectedTab.classList.add('active');

            console.log(`Switched to ${activeComputer}. Resetting charts and only processing data for this computer.`);
            
            if (typeof resetCharts === 'function') {
                resetCharts(); // Call resetCharts if it is defined
            }
        }
    }
});
