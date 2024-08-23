let activeComputer = localStorage.getItem('activeComputer') || 'Local';  
let computers = [];
let config;
let loadingTimeout;  // Variable to store the timeout ID
let dataReceived = false; // Flag to track if data is received

function showLoadingScreen() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';
        document.getElementById('loadingMessage').textContent = "Loading data, please wait...";

        // Reset dataReceived flag
        dataReceived = false;

        // Set a timeout to show a more detailed warning after 15 seconds
        loadingTimeout = setTimeout(() => {
            if (!dataReceived) { // Check if data has been received
                document.getElementById('loadingMessage').innerHTML = `
                This is taking longer than expected... <br>
                Please check your internet connection and the connection of ${activeComputer}. <br>
                We are still trying.`;

            }
        }, 15000); // 15 seconds
    } else {
        console.error("Loading overlay not found in the DOM.");
    }
}

function hideLoadingScreen() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
    clearTimeout(loadingTimeout);  // Clear the timeout if data loads in time
}

function connectWebSocket(computer, onMessageCallback) {
    const url = `ws://${computer.ip}:${computer.port}/ws`;
    console.log(`Connecting to WebSocket at ${url} for computer: ${computer.name}`);

    const socket = new WebSocket(url);

    socket.onopen = function() {
        console.log(`WebSocket connection established for ${computer.name}`);
    };

    socket.onmessage = function (event) {
        try {
            const data = JSON.parse(event.data);

            if (computer.name !== activeComputer) {
                console.log(`Received data for ${computer.name}, but ${activeComputer} is active. Ignoring.`);
                return;
            }

            console.log(`Processing data for active computer: ${computer.name}`);
            dataReceived = true; // Mark that data has been received
            onMessageCallback(data);
            hideLoadingScreen();  // Hide the loading screen once data is received
        } catch (error) {
            console.error("Error processing WebSocket message:", error);
        }
    };

    socket.onerror = function (error) {
        console.error("WebSocket error: ", error);
        // Do not hide the loading screen here to allow retries
    };

    socket.onclose = function () {
        console.log("WebSocket connection closed. Reconnecting in 1 second...");
        if (!dataReceived) {  // Only attempt to reconnect if data hasn't been received
            setTimeout(() => connectWebSocket(computer, onMessageCallback), 1000); // Reconnect on close
        }
    };
}

function fetchComputersAndConnect(onMessageCallback) {
    showLoadingScreen();  // Show the loading screen when fetching computers
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
            // If fetching computers fails, keep the loading screen active
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
            
            showLoadingScreen();  // Show the loading screen when switching computers
            fetchComputersAndConnect(onMessageCallback);
        }
    }
});
