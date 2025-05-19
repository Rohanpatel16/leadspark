/**
 * Validation Log Management Module
 */

import { showCopiedFeedback } from './utils.js';
import { formatDate } from './dashboard.js';

// Module variables
let logInitialPlaceholder;
let validationLogTable;
let validationLogTableBody;
let statusFilter;
let copyLogButton;
let clearLogButton;
let logCountElement;
let fullLogData = [];
let currentlyDisplayedLogData = [];

/**
 * Render validation log table with data
 * @param {Array<Object>} logEntries - Log entries to display
 */
function renderLogTable(logEntries) {
    if (!validationLogTableBody) {
        validationLogTableBody = document.getElementById('validationLogTableBody');
    }
    
    if (!logCountElement) {
        logCountElement = document.getElementById('logCount');
    }
    
    if (!validationLogTableBody || !validationLogTable || !logInitialPlaceholder || !logCountElement) {
        console.error('Log table elements not found');
        return;
    }

    validationLogTableBody.innerHTML = ''; 
    currentlyDisplayedLogData = []; 
    
    if (logEntries.length === 0) {
        validationLogTable.style.display = 'none';
        logInitialPlaceholder.textContent = 'No verification records match your criteria or the log is empty.';
        logInitialPlaceholder.style.display = 'block';
        logCountElement.textContent = '';
        copyLogButton.style.display = 'none'; 
        return;
    }
    
    logEntries.forEach(entry => {
        const row = validationLogTableBody.insertRow();
        row.insertCell().textContent = entry.email;
        
        const statusCell = row.insertCell(); 
        statusCell.className = 'status-cell';
        const statusSpan = document.createElement('span'); 
        statusSpan.textContent = entry.status;
        statusSpan.className = `status-${entry.status.toLowerCase()}`; 
        statusCell.appendChild(statusSpan);
        
        row.insertCell().textContent = entry.detail || '-';
        
        // Add source cell with a badge indicating where the email was found
        const sourceCell = row.insertCell();
        sourceCell.className = 'source-cell';
        if (entry.source) {
            const sourceSpan = document.createElement('span');
            sourceSpan.textContent = entry.source === 'finder' ? 'Email Finder' : 'Email Verifier';
            sourceSpan.className = `source-badge ${entry.source === 'finder' ? 'finder' : 'verifier'}`;
            sourceCell.appendChild(sourceSpan);
        } else {
            // For backward compatibility with older entries
            sourceCell.textContent = 'Verifier';
        }
        
        row.insertCell().textContent = formatDate(entry.timestamp);
        currentlyDisplayedLogData.push(entry); 
    });
    
    validationLogTable.style.display = 'table'; 
    logInitialPlaceholder.style.display = 'none';
    logCountElement.textContent = `Showing ${logEntries.length} record(s).`;
    copyLogButton.style.display = 'inline-block';
}

/**
 * Load and display validation log
 */
function loadAndDisplayLog() {
    logInitialPlaceholder = document.getElementById('log-initial-placeholder');
    validationLogTable = document.getElementById('validationLogTable');
    validationLogTableBody = document.getElementById('validationLogTableBody');
    statusFilter = document.getElementById('statusFilter');
    copyLogButton = document.getElementById('copyLogButton');
    clearLogButton = document.getElementById('clearLogButton');
    logCountElement = document.getElementById('logCount');

    const storedLogJSON = localStorage.getItem('leadSparkVerificationLog');
    fullLogData = storedLogJSON ? JSON.parse(storedLogJSON) : [];
    
    let selectedStatus = 'all';
    if (statusFilter) {
        selectedStatus = statusFilter.value;
    }
    
    let filteredLog = fullLogData;
    if (selectedStatus !== 'all') {
        filteredLog = fullLogData.filter(entry => entry.status === selectedStatus);
    }
    
    renderLogTable(filteredLog);
}

/**
 * Initialize validation log functionality
 */
function initializeValidationLog() {
    logInitialPlaceholder = document.getElementById('log-initial-placeholder');
    validationLogTable = document.getElementById('validationLogTable');
    validationLogTableBody = document.getElementById('validationLogTableBody');
    statusFilter = document.getElementById('statusFilter');
    copyLogButton = document.getElementById('copyLogButton');
    clearLogButton = document.getElementById('clearLogButton');
    logCountElement = document.getElementById('logCount');

    if (statusFilter) {
        statusFilter.addEventListener('change', loadAndDisplayLog);
    }
    
    if (copyLogButton) {
        copyLogButton.addEventListener('click', (e) => {
            if (currentlyDisplayedLogData.length > 0) {
                const textToCopy = currentlyDisplayedLogData.map(entry => 
                    `${entry.email},${entry.status},"${(entry.detail || '').replace(/"/g, '""')}",${formatDate(entry.timestamp)}`
                ).join('\n');
                navigator.clipboard.writeText(textToCopy)
                    .then(() => showCopiedFeedback(e.target))
                    .catch(err => console.error('Failed to copy log: ', err));
            } else { 
                e.target.textContent = "No log!";
                setTimeout(() => e.target.textContent = e.target.dataset.originalText, 1500);
            }
        });
    }
    
    if (clearLogButton) {
        clearLogButton.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear the entire verification log? This action cannot be undone.')) {
                localStorage.removeItem('leadSparkVerificationLog');
                localStorage.removeItem('leadSparkAllValidEmails');
                fullLogData = [];
                loadAndDisplayLog();
                
                // Update dashboard if possible
                if (typeof updateStats === 'function') updateStats();
                if (typeof loadAndDisplayValidEmails === 'function') loadAndDisplayValidEmails();
                if (typeof loadRecentActivity === 'function') loadRecentActivity();
                
                alert('Verification log and related stored valid emails cleared.');
            }
        });
    }
    
    // Add sorting functionality to table headers
    document.querySelectorAll('#validationLogTable th[data-sort]').forEach(headerCell => {
        headerCell.addEventListener('click', () => {
            const sortBy = headerCell.dataset.sort;
            const currentOrder = headerCell.dataset.order || 'desc';
            const newOrder = currentOrder === 'asc' ? 'desc' : 'asc';
            headerCell.dataset.order = newOrder;
            
            document.querySelectorAll('#validationLogTable th[data-sort]').forEach(th => {
                if (th !== headerCell) delete th.dataset.order;
            });
            
            const selectedStatus = statusFilter.value;
            let dataToSort = [...fullLogData];
            if (selectedStatus !== 'all') {
                dataToSort = dataToSort.filter(entry => entry.status === selectedStatus);
            }
            
            dataToSort.sort((a, b) => {
                let valA = a[sortBy]; 
                let valB = b[sortBy];
                
                if (sortBy === 'timestamp') { 
                    valA = new Date(valA); 
                    valB = new Date(valB);
                } else if (typeof valA === 'string') { 
                    valA = valA.toLowerCase(); 
                    valB = valB.toLowerCase();
                }
                
                if (valA < valB) return newOrder === 'asc' ? -1 : 1;
                if (valA > valB) return newOrder === 'asc' ? 1 : -1;
                return 0;
            });
            
            renderLogTable(dataToSort);
        });
    });
}

// Initialize log when DOM loads
document.addEventListener('DOMContentLoaded', initializeValidationLog);

export {
    loadAndDisplayLog
}; 