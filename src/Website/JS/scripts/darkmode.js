document.addEventListener("DOMContentLoaded", function () {
    // Dark mode toggle function
    function toggleDarkMode() {
        document.body.classList.toggle('dark-mode');
        let theme = 'light';
        if (document.body.classList.contains('dark-mode')) {
            theme = 'dark';
        }
        localStorage.setItem('theme', theme);
    }

    // Initialize dark mode if previously set, or default to dark mode
    const currentTheme = localStorage.getItem('theme');
    if (currentTheme === 'dark' || !currentTheme) {
        document.body.classList.add('dark-mode');
        document.getElementById('dark-mode-toggle').checked = true;
    } else if (currentTheme === 'light') {
        document.body.classList.remove('dark-mode');
        document.getElementById('dark-mode-toggle').checked = false;
    }

    // Add event listener to the dark mode toggle button
    document.getElementById('dark-mode-toggle').addEventListener('click', toggleDarkMode);
});