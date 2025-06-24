document.addEventListener('DOMContentLoaded', function () {
    const navbarContainer = document.getElementById('navbar-container');
    fetch('navbar.html')
        .then(response => response.text())
        .then(data => {
            navbarContainer.innerHTML = data;

       
            fetch('dashball.cfg')
                .then(response => response.json())
                .then(cfg => {
                    const pages = cfg.navbar_pages || {};
                    const navLinks = document.getElementById('nav-links');
                    navLinks.innerHTML = '';
                
                    const labels = {
                        'index.html': 'Home',
                        'history.html': 'History',
                        'gpu.html': 'GPU',
                        'cpu.html': 'CPU',
                        'disk.html': 'Disk',
                        'applications.html': 'Applications',
                        'custom.html': 'Custom'
                    };
                    Object.entries(pages).forEach(([href, show]) => {
                        if (show) {
                            const li = document.createElement('li');
                            const a = document.createElement('a');
                            a.href = href;
                            a.textContent = labels[href] || href;
                            li.appendChild(a);
                            navLinks.appendChild(li);
                        }
                    });

                    // Theme toggle visibility
                    const themeToggle = document.querySelector('.switch');
                    if (cfg.show_theme_toggle === false || cfg.show_theme_toggle === 'false') {
                        if (themeToggle) themeToggle.style.display = 'none';
                    } else {
                        if (themeToggle) themeToggle.style.display = '';
                    }

                    // Set theme based on cfg.theme if no localStorage value
                    const darkModeToggle = document.getElementById('dark-mode-toggle');
                    let storedMode = localStorage.getItem('darkMode');
                    if (storedMode === null) {
                        storedMode = (cfg.theme === 'white' || cfg.theme === 'light') ? 'false' : 'true';
                        localStorage.setItem('darkMode', storedMode);
                    }
                    const isDarkMode = storedMode === 'true';

                    if (isDarkMode) {
                        document.body.classList.add('dark-mode');
                        darkModeToggle.checked = true;
                    } else {
                        document.body.classList.remove('dark-mode');
                        darkModeToggle.checked = false;
                    }

                    darkModeToggle.addEventListener('change', function () {
                        document.body.classList.toggle('dark-mode', this.checked);
                        localStorage.setItem('darkMode', this.checked);
                    });

                    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
                    const menuItems = navLinks.querySelectorAll('a');
                    menuItems.forEach(item => {
                        if (item.getAttribute('href') === currentPage) {
                            item.classList.add('active');
                        }
                    });
                });

            // Hamburger menu script
            const hamburger = document.getElementById('hamburger-menu');
            const navLinks = document.getElementById('nav-links');
            hamburger.addEventListener('click', function () {
                navLinks.classList.toggle('show');
            });
        });
});
