/**
 * Dashboard Management Module
 */

import { showCopiedFeedback } from './utils.js';
import { getValidEmails, getDomainEmailCounts, storeValidEmail } from './firebase.js';

// Module variables
let dashboardValidEmailsList;
let noValidEmailsMessage;
let copyDisplayedValidButton;
let clearStoredEmailsButton;
let recentActivityList;
let noRecentActivityMessageDashboard;
let displayedValidEmails = [];
let domainStatsContainer;

/**
 * Load and display valid emails in the dashboard
 */
async function loadAndDisplayValidEmails() {
    dashboardValidEmailsList = document.getElementById('dashboardValidEmailsList');
    noValidEmailsMessage = document.getElementById('noValidEmailsMessage');
    copyDisplayedValidButton = document.getElementById('copyDisplayedValidButton');
    clearStoredEmailsButton = document.getElementById('clearStoredEmailsButton');
    domainStatsContainer = document.getElementById('domainStatsContainer');
    
    displayedValidEmails = []; 

    if (!dashboardValidEmailsList || !noValidEmailsMessage) {
        return;
    }
    
    dashboardValidEmailsList.innerHTML = ''; 
    
    try {
        console.log("Attempting to load emails from Firebase");
        
        // First try to get emails from Firebase
        const firebaseEmails = await getValidEmails(100); // Get up to 100 most recent emails
        console.log(`Retrieved ${firebaseEmails.length} emails from Firebase:`, firebaseEmails);
        
        // Also get domain stats
        const domainCounts = await getDomainEmailCounts();
        console.log("Domain counts:", domainCounts);
        displayDomainStats(domainCounts);
        
        // If firebase has no emails but localStorage does, migrate to firebase
        const storedEmailsJSON = localStorage.getItem('leadSparkAllValidEmails');
        const storedEmails = storedEmailsJSON ? JSON.parse(storedEmailsJSON) : [];
        
        if (firebaseEmails.length === 0 && storedEmails.length > 0) {
            console.log(`No emails in Firebase but found ${storedEmails.length} in localStorage, migrating...`);
            
            // Migrate localStorage emails to Firebase
            for (const email of storedEmails) {
                try {
                    await storeValidEmail({
                        email: email,
                        status: 'Valid',
                        detail: 'Migrated from localStorage',
                        timestamp: new Date().toISOString(),
                        source: 'migration'
                    });
                    console.log(`Migrated email to Firebase: ${email}`);
                } catch (err) {
                    console.error(`Error migrating email ${email} to Firebase:`, err);
                }
            }
            
            // Try loading emails from Firebase again
            const migratedEmails = await getValidEmails(100);
            console.log(`After migration, retrieved ${migratedEmails.length} emails from Firebase`);
            
            if (migratedEmails.length > 0) {
                displayEmailsFromFirebase(migratedEmails);
                return;
            }
        }
        
        if (firebaseEmails.length > 0) {
            displayEmailsFromFirebase(firebaseEmails);
        } else {
            // Fall back to local storage if no Firebase emails
            displayEmailsFromLocalStorage();
        }
    } catch (error) {
        console.error('Error loading emails from Firebase:', error);
        
        // Fall back to local storage in case of error
        displayEmailsFromLocalStorage();
    }
    
    // Setup copy button functionality
    setupCopyButton();
    
    // Setup clear button functionality
    setupClearButton();
}

/**
 * Display emails retrieved from Firebase
 */
function displayEmailsFromFirebase(firebaseEmails) {
    console.log("Displaying emails from Firebase");
    
    // Group emails by domain for display
    const emailsByDomain = {};
    
    // We have emails from Firebase
    firebaseEmails.forEach(emailData => {
        const domain = emailData.domain || 'unknown';
        if (!emailsByDomain[domain]) {
            emailsByDomain[domain] = [];
        }
        emailsByDomain[domain].push(emailData);
        displayedValidEmails.push(emailData.email);
    });
    
    // Display emails grouped by domain
    Object.keys(emailsByDomain).sort().forEach(domain => {
        // Add domain header
        const domainHeader = document.createElement('div');
        domainHeader.className = 'domain-header';
        domainHeader.innerHTML = `<strong>${domain}</strong> <span class="count">(${emailsByDomain[domain].length})</span>`;
        dashboardValidEmailsList.appendChild(domainHeader);
        
        // Add emails for this domain
        emailsByDomain[domain].forEach(emailData => {
            const li = document.createElement('li'); 
            li.textContent = emailData.email;
            
            // Add source badge
            if (emailData.source) {
                const sourceBadge = document.createElement('span');
                sourceBadge.className = 'source-badge';
                sourceBadge.textContent = emailData.source;
                li.appendChild(sourceBadge);
            }
            
            // Add find count badge
            if (emailData.findCount && emailData.findCount > 1) {
                const findCountBadge = document.createElement('span');
                findCountBadge.className = 'find-count';
                findCountBadge.textContent = emailData.findCount;
                li.appendChild(findCountBadge);
            }
            
            dashboardValidEmailsList.appendChild(li);
        });
    });
    
    dashboardValidEmailsList.style.display = 'block'; 
    noValidEmailsMessage.style.display = 'none';
    copyDisplayedValidButton.style.display = 'inline-block'; 
    clearStoredEmailsButton.style.display = 'inline-block';
}

/**
 * Display emails from localStorage as fallback
 */
function displayEmailsFromLocalStorage() {
    console.log("Falling back to emails from localStorage");
    
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

/**
 * Setup the copy button functionality
 */
function setupCopyButton() {
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
}

/**
 * Setup the clear button functionality
 */
function setupClearButton() {
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
 * Display domain statistics in the dashboard
 * @param {Object} domainCounts - Object with domains as keys and counts as values
 */
function displayDomainStats(domainCounts) {
    if (!domainStatsContainer) {
        domainStatsContainer = document.getElementById('domainStatsContainer');
        if (!domainStatsContainer) return;
    }
    
    domainStatsContainer.innerHTML = '';
    
    // If no domains, show message
    if (Object.keys(domainCounts).length === 0) {
        domainStatsContainer.innerHTML = '<p>No domain statistics available.</p>';
        return;
    }
    
    // Create a table for domain stats
    const table = document.createElement('table');
    table.className = 'domain-stats-table';
    
    // Add header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.innerHTML = `
        <th>Domain</th>
        <th>Email Count</th>
    `;
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Add body
    const tbody = document.createElement('tbody');
    
    // Sort domains by count (descending)
    const sortedDomains = Object.keys(domainCounts).sort((a, b) => domainCounts[b] - domainCounts[a]);
    
    sortedDomains.forEach(domain => {
        const count = domainCounts[domain];
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${domain}</td>
            <td>${count}</td>
        `;
        tbody.appendChild(row);
    });
    
    table.appendChild(tbody);
    domainStatsContainer.appendChild(table);
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