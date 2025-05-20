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

/**
 * Extract all email addresses from any text
 * @param {string} text - The input text which may contain multiple emails in various formats
 * @returns {string[]} Array of extracted email addresses
 */
function extractEmails(text) {
    if (!text) return [];
    
    // First, normalize line breaks and common separators
    text = text.replace(/[\r\n,;]+/g, ' ');
    
    // Email regex pattern - matches standard email format
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    
    // Extract all emails
    const emails = text.match(emailPattern) || [];
    
    // Remove duplicates and clean up
    return [...new Set(emails.map(email => email.trim()))];
}

/**
 * Extract the domain from a string that could be a URL, email, or domain
 * @param {string} input - The input string which could be formatted as a URL, email, or plain domain
 * @returns {string} The extracted domain name
 */
function extractDomain(input) {
    if (!input) return '';
    
    // Remove leading @ if present
    input = input.trim().replace(/^@/, '');
    
    // Extract domain from email address (if it is an email)
    if (input.includes('@') && !input.startsWith('http')) {
        input = input.split('@')[1];
    }
    
    // Remove protocol (http://, https://, etc.)
    input = input.replace(/^(?:https?:\/\/)?(?:www\.)?/i, '');
    
    // Remove trailing slash and anything after it
    input = input.split('/')[0];
    
    // Remove any query parameters or hash fragments
    input = input.split('?')[0].split('#')[0];
    
    return input;
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
    extractEmails,
    extractDomain,
    applyTheme,
    setupTheme,
    setupNavbarToggle,
    setCurrentYear
}; 