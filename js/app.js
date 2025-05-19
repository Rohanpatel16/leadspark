/**
 * Main Application Logic for LeadSpark
 */

import { setupTheme, setupNavbarToggle, setCurrentYear } from './utils.js';
import { updateApiConfig } from './api.js';
import { initEmailFinderScripts } from './emailFinder.js';
import { initEmailVerifierScripts } from './emailVerifier.js';
import { loadSettings } from './settings.js';
import { 
    updateStats as dashboardUpdateStats, 
    loadAndDisplayValidEmails as dashboardLoadAndDisplayValidEmails,
    loadRecentActivity as dashboardLoadRecentActivity
} from './dashboard.js';
import { loadAndDisplayLog as validationLogLoadAndDisplayLog } from './validationLog.js';
import { initDatabaseStructure, storeValidEmail } from './firebase.js';

// --- Global Variables and Elements ---
let allPageContents;
let navLinks;
let mainNavbarToggler;
let mainNavbarNav;
let mainThemeToggleBtn;
let mainCurrentYearSpan;

/**
 * Initialize global element references
 */
function initializeElementReferences() {
    allPageContents = document.querySelectorAll('.page-content');
    navLinks = document.querySelectorAll('.navbar-nav .nav-link');
    mainNavbarToggler = document.querySelector('.navbar-toggler');
    mainNavbarNav = document.querySelector('.navbar-nav');
    mainThemeToggleBtn = document.getElementById('themeToggle');
    mainCurrentYearSpan = document.getElementById('currentYear');
    
    // Make elements accessible to other modules
    window.mainThemeToggleBtn = mainThemeToggleBtn;
    window.mainNavbarToggler = mainNavbarToggler;
    window.mainNavbarNav = mainNavbarNav;
    window.mainCurrentYearSpan = mainCurrentYearSpan;
}

/**
 * Show a specific page and handle navigation state
 * @param {string} pageId - ID of the page to show
 */
function showPage(pageId) {
    allPageContents.forEach(page => {
        page.style.display = 'none';
        page.classList.remove('active');
    });
    
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.style.display = 'block';
        targetPage.classList.add('active');
    }

    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('data-page') === pageId) {
            link.classList.add('active');
        }
    });

    let pageTitle = "LeadSpark";
    if (pageId === 'home-page-content') pageTitle = "LeadSpark - Home";
    else if (pageId === 'email-finder-page-content') pageTitle = "LeadSpark - Email Finder";
    else if (pageId === 'email-verifier-page-content') pageTitle = "LeadSpark - Email Verifier";
    else if (pageId === 'dashboard-page-content') pageTitle = "LeadSpark - Dashboard";
    else if (pageId === 'validation-log-page-content') pageTitle = "LeadSpark - Validation Log";
    document.title = pageTitle;
    
    window.scrollTo(0, 0); 

    // Load data for specific pages if needed
    if (pageId === 'dashboard-page-content') {
        dashboardUpdateStats();
        dashboardLoadAndDisplayValidEmails();
        dashboardLoadRecentActivity();
    }
    if (pageId === 'validation-log-page-content') {
        validationLogLoadAndDisplayLog();
    }
}

/**
 * Initialize application
 */
function initializeApp() {
    initializeElementReferences();
    
    // Setup common functionality
    setupTheme();
    setupNavbarToggle();
    setCurrentYear();
    
    // Test Firebase connection
    testFirebaseConnection();
    
    // Load settings first to initialize correct API configuration
    loadSettings();
    updateApiConfig();
    
    // Initialize page-specific functionality
    initEmailFinderScripts();
    initEmailVerifierScripts();
    
    // Setup page navigation links
    document.querySelectorAll('[href^="javascript:showPage"]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const pageId = link.getAttribute('href').replace('javascript:showPage(\'', '').replace('\');', '');
            showPage(pageId);
        });
    });
    
    // Show the initial page
    showPage('home-page-content');
}

/**
 * Test Firebase database connection
 */
async function testFirebaseConnection() {
    console.log('Testing Firebase database connection...');
    
    try {
        // Initialize database structure
        await initDatabaseStructure();
        
        // Store a test record
        const testResult = await storeValidEmail({
            email: 'connection-test@example.com',
            status: 'Test',
            detail: 'Firebase connection test',
            timestamp: new Date().toISOString()
        });
        
        console.log('Firebase connection test result:', testResult ? 'SUCCESS' : 'FAILED');
    } catch (error) {
        console.error('Firebase connection test error:', error);
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeApp);

// Export for global access
window.showPage = showPage;

export {
    showPage
}; 