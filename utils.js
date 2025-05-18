/**
 * Utility functions for LeadSpark
 */

// --- Utility: Show "Copied!" message on buttons ---
function showCopiedFeedback(buttonElement) {
    const originalText = buttonElement.dataset.originalText || buttonElement.textContent;
    buttonElement.textContent = 'Copied!';
    buttonElement.classList.add('copied');
    buttonElement.disabled = true;

    setTimeout(() => {
        buttonElement.textContent = originalText;
        buttonElement.classList.remove('copied');
        buttonElement.disabled = false;
    }, 1500);
}

// --- Common JS: Theme Toggle, Navbar Toggle, Set Current Year ---
function applyTheme(theme) {
    if (theme === 'dark') {
        document.body.classList.add('dark-theme');
        if (window.mainThemeToggleBtn) window.mainThemeToggleBtn.textContent = '☀️'; // sunIcon
    } else {
        document.body.classList.remove('dark-theme');
        if (window.mainThemeToggleBtn) window.mainThemeToggleBtn.textContent = '🌙'; // moonIcon
    }
}

function setupTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) { 
        applyTheme(savedTheme); 
    } else { 
        applyTheme(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); 
    }
    
    if (window.mainThemeToggleBtn) {
        window.mainThemeToggleBtn.addEventListener('click', () => {
            let newTheme = document.body.classList.contains('dark-theme') ? 'light' : 'dark';
            localStorage.setItem('theme', newTheme); 
            applyTheme(newTheme);
        });
    }
    
    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
            const newColorScheme = event.matches ? "dark" : "light";
            const storedTheme = localStorage.getItem('theme');
            if (!storedTheme || storedTheme === newColorScheme) { 
                applyTheme(newColorScheme);
                if(storedTheme !== newColorScheme) localStorage.setItem('theme', newColorScheme); 
            }
        });
    }
}

function setupNavbarToggle() {
    if (window.mainNavbarToggler && window.mainNavbarNav) {
        window.mainNavbarToggler.addEventListener('click', () => {
            const isExpanded = window.mainNavbarToggler.getAttribute('aria-expanded') === 'true' || false;
            window.mainNavbarToggler.setAttribute('aria-expanded', String(!isExpanded));
            window.mainNavbarNav.classList.toggle('active');
            window.mainNavbarToggler.innerHTML = window.mainNavbarNav.classList.contains('active') ? '<span>×</span>' : '<span>☰</span>';
        });
        
        window.mainNavbarNav.querySelectorAll('a.nav-link, .navbar-brand').forEach(link => {
            link.addEventListener('click', (e) => {
                 if (window.mainNavbarNav.classList.contains('active') && window.innerWidth <= 768) {
                    if (!e.target.closest('.theme-toggle-btn') && e.target.id !== 'themeToggle') {
                        window.mainNavbarNav.classList.remove('active');
                        window.mainNavbarToggler.setAttribute('aria-expanded', 'false');
                        window.mainNavbarToggler.innerHTML = '<span>☰</span>';
                    }
                }
            });
        });
    }
}

function setCurrentYear() {
    if (window.mainCurrentYearSpan) { 
        window.mainCurrentYearSpan.textContent = new Date().getFullYear(); 
    }
}

// Export utilities for modules
export {
    showCopiedFeedback,
    applyTheme,
    setupTheme,
    setupNavbarToggle,
    setCurrentYear
}; 