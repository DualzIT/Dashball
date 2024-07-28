document.addEventListener('DOMContentLoaded', function () {
  const navbarContainer = document.getElementById('navbar-container');
  fetch('navbar.html')
      .then(response => response.text())
      .then(data => {
          navbarContainer.innerHTML = data;

          // Hamburger menu script
          const hamburger = document.getElementById('hamburger-menu');
          const navLinks = document.getElementById('nav-links');
          hamburger.addEventListener('click', function () {
              navLinks.classList.toggle('show');
          });

          // Set active class based on current page
          const currentPage = window.location.pathname.split('/').pop();
          const menuItems = document.querySelectorAll('#nav-links a');
          menuItems.forEach(item => {
              if (item.getAttribute('href') === currentPage) {
                  item.classList.add('active');
              }
          });

          // Dark mode script
          const darkModeToggle = document.getElementById('dark-mode-toggle');
          darkModeToggle.addEventListener('change', function () {
              document.body.classList.toggle('dark-mode', this.checked);
          });
      });
});
