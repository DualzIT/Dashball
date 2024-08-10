document.addEventListener("DOMContentLoaded", function () {
    const tabsContainer = document.getElementById('computer-tabs');
    const addComputerButton = document.getElementById('add-computer-button');
    const computerOverlay = document.getElementById('computer-overlay');
    const closeButton = document.querySelector('.close-button');

    // Function to create a tab
    function createTab(computer) {
        const tab = document.createElement('li');
        tab.setAttribute('data-computer-name', computer.name);
        tab.textContent = computer.name;

        // Voeg de 'active' class toe aan de eerste tab die wordt aangemaakt
        if (tabsContainer.children.length === 0) {
            tab.classList.add('active');
        }

        tabsContainer.appendChild(tab);
    }

    // Fetch computers.json and generate tabs
    fetch('../../computers.json')
        .then(response => response.json())
        .then(data => {
            data.computers.forEach(computer => {
                createTab(computer);
            });
        })
        .catch(error => {
            console.error('ERROR:', error);
        });

    // Show the overlay when Add Computer button is clicked
    addComputerButton.addEventListener('click', function () {
        computerOverlay.style.display = 'flex';
    });

    // Close the overlay when the close button is clicked
    closeButton.addEventListener('click', function () {
        computerOverlay.style.display = 'none';
    });

    // Close the overlay if clicked outside the content area
    computerOverlay.addEventListener('click', function (event) {
        if (event.target === computerOverlay) {
            computerOverlay.style.display = 'none';
        }
    });
});
