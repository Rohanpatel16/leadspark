/**
 * Dashboard Management Module
 */

import { showCopiedFeedback } from './utils.js';
import { getValidEmails } from './firebase.js';

// Module variables
let dashboardValidEmailsList;
let noValidEmailsMessage;
let copyDisplayedValidButton;
let clearStoredEmailsButton;
let recentActivityList;
let noRecentActivityMessageDashboard;
let displayedValidEmails = [];

/**
 * Load and display valid emails in the dashboard
 */
async function loadAndDisplayValidEmails() {
    dashboardValidEmailsList = document.getElementById('dashboardValidEmailsList');
    noValidEmailsMessage = document.getElementById('noValidEmailsMessage');
    copyDisplayedValidButton = document.getElementById('copyDisplayedValidButton');
    clearStoredEmailsButton = document.getElementById('clearStoredEmailsButton');
    
    displayedValidEmails = []; 

    if (!dashboardValidEmailsList || !noValidEmailsMessage) {
        return;
    }
    
    dashboardValidEmailsList.innerHTML = ''; 
    
    try {
        // First try to get emails from Firebase
        const firebaseEmails = await getValidEmails(20); // Get up to 20 most recent emails
        
        if (firebaseEmails.length > 0) {
            // We have emails from Firebase
            firebaseEmails.forEach(emailData => {
                const li = document.createElement('li'); 
                li.textContent = emailData.email;
                dashboardValidEmailsList.appendChild(li);
                displayedValidEmails.push(emailData.email); 
            });
            
            dashboardValidEmailsList.style.display = 'block'; 
            noValidEmailsMessage.style.display = 'none';
            copyDisplayedValidButton.style.display = 'inline-block'; 
            clearStoredEmailsButton.style.display = 'inline-block';
        } else {
            // Fall back to local storage if no Firebase emails
            const storedEmailsJSON = localStorage.getItem('leadSparkAllValidEmails');
            const storedEmails = storedEmailsJSON ? JSON.parse(storedEmailsJSON) : [];
            
            if (storedEmails.length > 0) {
                const emailsToDisplay = storedEmails.slice(-20).reverse(); // Get last 20, newest first
                emailsToDisplay.forEach(email => {
                    const li = document.createElement('li'); 
                    li.textContent = email;
                    dashboardValidEmailsList.appendChild(li);
                    displayedValidEmails.push(email); 
                });
                
                dashboardValidEmailsList.style.display = 'block'; 
                noValidEmailsMessage.style.display = 'none';
                copyDisplayedValidButton.style.display = 'inline-block'; 
                clearStoredEmailsButton.style.display = 'inline-block';
            } else {
                dashboardValidEmailsList.style.display = 'none'; 
                noValidEmailsMessage.style.display = 'block';
                copyDisplayedValidButton.style.display = 'none'; 
                clearStoredEmailsButton.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Error loading emails from Firebase:', error);
        
        // Fall back to local storage in case of error
        const storedEmailsJSON = localStorage.getItem('leadSparkAllValidEmails');
        const storedEmails = storedEmailsJSON ? JSON.parse(storedEmailsJSON) : [];
        
        if (storedEmails.length > 0) {
            const emailsToDisplay = storedEmails.slice(-20).reverse(); // Get last 20, newest first
            emailsToDisplay.forEach(email => {
                const li = document.createElement('li'); 
                li.textContent = email;
                dashboardValidEmailsList.appendChild(li);
                displayedValidEmails.push(email); 
            });
            
            dashboardValidEmailsList.style.display = 'block'; 
            noValidEmailsMessage.style.display = 'none';
            copyDisplayedValidButton.style.display = 'inline-block'; 
            clearStoredEmailsButton.style.display = 'inline-block';
        } else {
            dashboardValidEmailsList.style.display = 'none'; 
            noValidEmailsMessage.style.display = 'block';
            copyDisplayedValidButton.style.display = 'none'; 
            clearStoredEmailsButton.style.display = 'none';
        }
    }
    
    // Setup copy button functionality
    if (copyDisplayedValidButton) {
        copyDisplayedValidButton.onclick = (e) => {
            if (displayedValidEmails.length > 0) {
                navigator.clipboard.writeText(displayedValidEmails.join('\n'))
                    .then(() => showCopiedFeedback(e.target))
                    .catch(err => console.error('Failed to copy displayed emails: ', err));
            } else { 
                e.target.textContent = "No emails!";
                setTimeout(() => e.target.textContent = e.target.dataset.originalText, 1500);
            }
        };
    }
    
    // Setup clear button functionality
    if (clearStoredEmailsButton) {
        clearStoredEmailsButton.onclick = () => {
            if (confirm('Are you sure you want to clear all stored valid emails? This cannot be undone.')) {
                localStorage.removeItem('leadSparkAllValidEmails');
                loadAndDisplayValidEmails(); 
                updateStats(); 
                alert('Local stored valid emails have been cleared. Note that emails in Firebase will still be available.');
            }
        };
    }
}

/**
 * Update dashboard statistics
 */
function updateStats() {
    const logData = JSON.parse(localStorage.getItem('leadSparkVerificationLog') || '[]');
    
    const statTotalFound = document.getElementById('statTotalFound');
    const statTotalVerified = document.getElementById('statTotalVerified');
    const statValidEmails = document.getElementById('statValidEmails');
    const statRiskyEmails = document.getElementById('statRiskyEmails');
    
    if (statTotalFound) {
        // This just shows the session "found" value
        const allFoundEmailsCount = JSON.parse(localStorage.getItem('leadSparkAllValidEmails') || '[]').length;
        statTotalFound.textContent = allFoundEmailsCount;
    }
    
    if (statTotalVerified) {
        statTotalVerified.textContent = logData.length;
    }
    
    if (statValidEmails) {
        statValidEmails.textContent = logData.filter(e => e.status === 'Valid').length;
    }
    
    if (statRiskyEmails) {
        statRiskyEmails.textContent = logData.filter(e => e.status === 'Risky').length;
    }
}

/**
 * Format a date string to readable format
 */
function formatDate(isoString) {
    if (!isoString) return 'N/A'; 
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) + ' ' + 
           date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit'});
}

/**
 * Load recent activity for the dashboard
 */
function loadRecentActivity() {
    recentActivityList = document.getElementById('recentActivityList');
    noRecentActivityMessageDashboard = document.getElementById('noRecentActivityMessageDashboard');
    
    if (!recentActivityList || !noRecentActivityMessageDashboard) return;

    const logData = JSON.parse(localStorage.getItem('leadSparkVerificationLog') || '[]');
    recentActivityList.innerHTML = ''; 

    if (logData.length === 0) {
        recentActivityList.appendChild(noRecentActivityMessageDashboard); 
        return;
    }
    
    if (recentActivityList.querySelector('#noRecentActivityMessageDashboard')) {
        recentActivityList.querySelector('#noRecentActivityMessageDashboard').style.display = 'none';
    }
    
    const recentItems = logData.slice(0, 5); // Most recent 5 items
    recentItems.forEach(item => {
        const li = document.createElement('li');
        li.className = 'activity-item';
        
        const p = document.createElement('p');
        p.textContent = `Verified: ${item.email} (Status: ${item.status})`;
        
        const span = document.createElement('span');
        span.className = 'timestamp';
        span.textContent = formatDate(item.timestamp); 
        
        li.appendChild(p);
        li.appendChild(span);
        recentActivityList.appendChild(li);
    });
}

/**
 * Initialize dashboard functionality
 */
function initializeDashboard() {
    loadAndDisplayValidEmails();
    updateStats();
    loadRecentActivity();
}

// Initialize dashboard when DOM loads
document.addEventListener('DOMContentLoaded', initializeDashboard);

// Export dashboard functions
export {
    loadAndDisplayValidEmails,
    updateStats,
    loadRecentActivity,
    formatDate
}; 