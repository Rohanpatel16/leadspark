/**
 * Dashboard Management Module
 */

import { showCopiedFeedback } from './utils.js';
import { getValidEmails, getEmailsByDomain } from './firebase.js';

// Module variables
let dashboardValidEmailsList;
let noValidEmailsMessage;
let copyDisplayedValidButton;
let clearStoredEmailsButton;
let recentActivityList;
let noRecentActivityMessageDashboard;
let displayedValidEmails = [];

/**
 * Populate domain selector with available domains
 */
async function populateDomainSelector() {
    const domainSelector = document.getElementById('domainSelector');
    if (!domainSelector) return;
    
    try {
        // Get all emails to extract domains
        const allEmails = await getValidEmails(500); // Get a larger set to find domains
        
        // Extract unique domains
        const domains = new Set();
        allEmails.forEach(email => {
            if (email.domain) {
                domains.add(email.domain);
            } else if (email.email && email.email.includes('@')) {
                const domain = email.email.split('@')[1];
                domains.add(domain);
            }
        });
        
        // Clear existing options except for the first placeholder
        while (domainSelector.options.length > 1) {
            domainSelector.remove(1);
        }
        
        // Add domains to selector
        Array.from(domains).sort().forEach(domain => {
            const option = document.createElement('option');
            option.value = domain;
            option.textContent = domain;
            domainSelector.appendChild(option);
        });
        
        // Add event listener
        if (!domainSelector.getAttribute('data-initialized')) {
            domainSelector.addEventListener('change', handleDomainSelection);
            domainSelector.setAttribute('data-initialized', 'true');
        }
    } catch (error) {
        console.error('Error populating domain selector:', error);
    }
}

/**
 * Handle domain selection change
 */
async function handleDomainSelection() {
    const domainSelector = document.getElementById('domainSelector');
    const domainEmailsList = document.getElementById('domainEmailsList');
    const noDomainSelectedMessage = document.getElementById('noDomainSelectedMessage');
    const domainStats = document.getElementById('domainStats');
    const domainEmailCount = document.getElementById('domainEmailCount');
    
    if (!domainSelector || !domainEmailsList || !noDomainSelectedMessage || !domainStats) return;
    
    const selectedDomain = domainSelector.value;
    
    if (!selectedDomain) {
        noDomainSelectedMessage.style.display = 'block';
        domainEmailsList.style.display = 'none';
        domainStats.style.display = 'none';
        return;
    }
    
    try {
        // Show loading state
        noDomainSelectedMessage.textContent = 'Loading emails...';
        noDomainSelectedMessage.style.display = 'block';
        domainEmailsList.style.display = 'none';
        
        // Fetch emails for selected domain
        const emails = await getEmailsByDomain(selectedDomain, 100);
        
        if (emails.length === 0) {
            noDomainSelectedMessage.textContent = `No emails found for domain: ${selectedDomain}`;
            domainStats.style.display = 'none';
            return;
        }
        
        // Populate the emails list
        domainEmailsList.innerHTML = '';
        emails.forEach(email => {
            const li = document.createElement('li');
            const emailText = document.createElement('span');
            emailText.textContent = email.email;
            li.appendChild(emailText);
            
            // Add source badge if available
            if (email.source) {
                const sourceBadge = document.createElement('span');
                sourceBadge.className = 'email-source';
                sourceBadge.textContent = email.source === 'finder' ? 'Finder' : 'Verifier';
                li.appendChild(sourceBadge);
            }
            
            domainEmailsList.appendChild(li);
        });
        
        // Update stats
        domainEmailCount.textContent = emails.length;
        
        // Show results
        noDomainSelectedMessage.style.display = 'none';
        domainEmailsList.style.display = 'block';
        domainStats.style.display = 'block';
    } catch (error) {
        console.error('Error loading emails for domain:', error);
        noDomainSelectedMessage.textContent = `Error loading emails for domain: ${selectedDomain}`;
        domainStats.style.display = 'none';
    }
}

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
        
        // Deduplicate emails (just to be sure)
        const uniqueEmails = [];
        const emailSet = new Set();
        
        firebaseEmails.forEach(emailData => {
            if (!emailSet.has(emailData.email)) {
                emailSet.add(emailData.email);
                uniqueEmails.push(emailData);
            }
        });
        
        if (uniqueEmails.length > 0) {
            // We have emails from Firebase
            uniqueEmails.forEach(emailData => {
                const li = document.createElement('li'); 
                
                // Create container for email and source badge
                const container = document.createElement('div');
                container.style.display = 'flex';
                container.style.justifyContent = 'space-between';
                container.style.alignItems = 'center';
                container.style.width = '100%';
                
                // Email text
                const emailText = document.createElement('span');
                emailText.textContent = emailData.email;
                container.appendChild(emailText);
                
                // Source badge if available
                if (emailData.source) {
                    const sourceBadge = document.createElement('span');
                    sourceBadge.className = 'source-badge';
                    sourceBadge.classList.add(emailData.source);
                    sourceBadge.textContent = emailData.source === 'finder' ? 'F' : 'V';
                    sourceBadge.title = emailData.source === 'finder' ? 'Found by Email Finder' : 'Verified by Email Verifier';
                    sourceBadge.style.fontSize = '0.7em';
                    sourceBadge.style.padding = '0.1em 0.4em';
                    sourceBadge.style.borderRadius = '3px';
                    sourceBadge.style.marginLeft = '0.5rem';
                    container.appendChild(sourceBadge);
                }
                
                li.appendChild(container);
                dashboardValidEmailsList.appendChild(li);
                displayedValidEmails.push(emailData.email); 
            });
            
            dashboardValidEmailsList.style.display = 'block'; 
            noValidEmailsMessage.style.display = 'none';
            copyDisplayedValidButton.style.display = 'inline-block'; 
            clearStoredEmailsButton.style.display = 'inline-block';
            
            // Also populate domain selector
            populateDomainSelector();
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
    populateDomainSelector();
}

// Initialize dashboard when DOM loads
document.addEventListener('DOMContentLoaded', initializeDashboard);

// Export dashboard functions
export {
    loadAndDisplayValidEmails,
    updateStats,
    loadRecentActivity,
    formatDate,
    populateDomainSelector,
    handleDomainSelection
}; 