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
import { initDatabaseStructure } from './firebase.js';

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
    if (pageId === 'home-page-content') {
        // Refresh Recent Activity when returning to home page
        loadHomeActivity();
    }
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
    
    // Initialize database structure and test connection
    initDatabaseStructure();
    
    // Test Firebase connection using the global function
    if (typeof window.testFirebaseConnection === 'function') {
        window.testFirebaseConnection();
    }
    
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
    
    // Initialize home page activity display
    loadHomeActivity();
    
    // Show the initial page
    showPage('home-page-content');
}

/**
 * Load and display actual recent activity on the home page
 */
function loadHomeActivity() {
    const homeActivityContainer = document.getElementById('home-activity-container');
    const noActivityMessage = document.getElementById('no-activity-message');
    
    if (!homeActivityContainer) return;
    
    // Clear existing content except the no-activity message
    Array.from(homeActivityContainer.children).forEach(child => {
        if (child.id !== 'no-activity-message') {
            homeActivityContainer.removeChild(child);
        }
    });
    
    // Get activity data from localStorage
    const logData = JSON.parse(localStorage.getItem('leadSparkVerificationLog') || '[]');
    
    if (logData.length === 0) {
        // Show the encouraging message if no activity
        if (noActivityMessage) {
            noActivityMessage.style.display = 'block';
        }
        return;
    }
    
    // Hide the no-activity message
    if (noActivityMessage) {
        noActivityMessage.style.display = 'none';
    }
    
    // Format and display recent activities (most recent first)
    const recentActivities = logData.slice(-3).reverse(); // Get the 3 most recent activities
    
    recentActivities.forEach(activity => {
        const activityItem = document.createElement('div');
        activityItem.className = 'activity-item';
        
        const activityText = document.createElement('p');
        if (activity.source === 'finder') {
            activityText.innerHTML = `<strong>Searched:</strong> ${activity.domain || 'Unknown domain'} (Email: ${activity.email})`;
        } else {
            activityText.innerHTML = `<strong>Verified:</strong> ${activity.email} (Status: ${activity.status})`;
        }
        
        const timestamp = document.createElement('span');
        timestamp.className = 'timestamp';
        
        // Format the timestamp more accurately
        const activityDate = new Date(activity.timestamp);
        const now = new Date();
        
        // Reset time components to compare just the dates
        const activityDateOnly = new Date(activityDate.getFullYear(), activityDate.getMonth(), activityDate.getDate());
        const todayDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterdayDateOnly = new Date(todayDateOnly);
        yesterdayDateOnly.setDate(yesterdayDateOnly.getDate() - 1);
        
        // Calculate difference in days
        const diffMs = todayDateOnly - activityDateOnly;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (activityDateOnly.getTime() === todayDateOnly.getTime()) {
            // Today - show hours/minutes
            const diffHours = Math.floor((now - activityDate) / (1000 * 60 * 60));
            if (diffHours === 0) {
                const diffMinutes = Math.floor((now - activityDate) / (1000 * 60));
                timestamp.textContent = `${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`;
            } else {
                timestamp.textContent = `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
            }
        } else if (activityDateOnly.getTime() === yesterdayDateOnly.getTime()) {
            timestamp.textContent = 'Yesterday';
        } else {
            // Format the date with month and day
            timestamp.textContent = activityDate.toLocaleDateString(undefined, { 
                month: 'short', 
                day: 'numeric' 
            });
        }
        
        activityItem.appendChild(activityText);
        activityItem.appendChild(timestamp);
        homeActivityContainer.appendChild(activityItem);
    });
    
    // Update the "View All Activity" link visibility based on data availability
    const viewAllLink = document.getElementById('homeViewAllActivityLink');
    if (viewAllLink) {
        viewAllLink.style.display = logData.length > 3 ? 'inline-block' : 'none';
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeApp);

// Export for global access
window.showPage = showPage;

export {
    showPage
}; 