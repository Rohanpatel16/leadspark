/**
 * Validation Log Management Module
 */

import { showCopiedFeedback } from './utils.js';
import { formatDate } from './dashboard.js';
import { 
  getAllDomains, 
  getEmailsByDomain, 
  getAllConsolidatedDomains, 
  getConsolidatedDomain 
} from './firebase.js';

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
let domainFilterDropdown;
let showConsolidatedViewButton;
let consolidatedDomainsContainer;

/**
 * Display consolidated domains view
 */
async function displayConsolidatedDomains() {
  try {
    if (!consolidatedDomainsContainer) {
      // Create container if it doesn't exist
      const logTable = document.getElementById('validationLogTable');
      if (!logTable) return;
      
      consolidatedDomainsContainer = document.createElement('div');
      consolidatedDomainsContainer.id = 'consolidated-domains-container';
      consolidatedDomainsContainer.className = 'consolidated-domains';
      consolidatedDomainsContainer.style.display = 'none';
      logTable.parentNode.insertBefore(consolidatedDomainsContainer, logTable);
    }
    
    // Toggle between table and consolidated view
    const logTable = document.getElementById('validationLogTable');
    const isShowingConsolidated = consolidatedDomainsContainer.style.display !== 'none';
    
    if (isShowingConsolidated) {
      // Switch to regular table view
      consolidatedDomainsContainer.style.display = 'none';
      logTable.style.display = 'table';
      if (showConsolidatedViewButton) {
        showConsolidatedViewButton.textContent = 'Show Domains View';
      }
      return;
    }
    
    // Switch to consolidated view
    logTable.style.display = 'none';
    consolidatedDomainsContainer.style.display = 'block';
    if (showConsolidatedViewButton) {
      showConsolidatedViewButton.textContent = 'Show Table View';
    }
    
    // Show loading indicator
    consolidatedDomainsContainer.innerHTML = '<p class="loading-indicator">Loading domains...</p>';
    
    // Fetch consolidated domains
    const domains = await getAllConsolidatedDomains();
    
    if (!domains || domains.length === 0) {
      consolidatedDomainsContainer.innerHTML = '<p class="no-domains">No domains found.</p>';
      return;
    }
    
    // Create HTML for domains
    let html = '<div class="domains-list">';
    
    for (const domain of domains) {
      const domainClass = domain.emailCount > 0 ? 'domain-card' : 'domain-card empty';
      html += `
        <div class="domain-card" data-domain="${domain.domain}">
          <div class="domain-header">
            <h3>${domain.domain}</h3>
            <span class="email-count">${domain.emailCount} emails</span>
          </div>
          <div class="domain-info">
            <span class="last-updated">Last updated: ${new Date(domain.lastUpdated).toLocaleString()}</span>
            <span class="uuid">ID: ${domain.uuid}</span>
          </div>
          <div class="email-list">
            <ul>
              ${domain.emails.map(email => `<li>${email}</li>`).join('')}
            </ul>
          </div>
          <div class="domain-actions">
            <button class="btn btn-sm btn-secondary copy-domain-emails" data-domain="${domain.domain}">Copy Emails</button>
            <button class="btn btn-sm btn-secondary export-domain-csv" data-domain="${domain.domain}">Export CSV</button>
          </div>
        </div>
      `;
    }
    
    html += '</div>';
    consolidatedDomainsContainer.innerHTML = html;
    
    // Add event listeners to copy buttons
    document.querySelectorAll('.copy-domain-emails').forEach(button => {
      button.addEventListener('click', async (e) => {
        const domain = e.target.dataset.domain;
        const domainData = await getConsolidatedDomain(domain);
        if (domainData && domainData.emails) {
          const emailsText = domainData.emails.join('\n');
          await navigator.clipboard.writeText(emailsText);
          showCopiedFeedback(e.target);
        }
      });
    });
    
    // Add event listeners to export buttons
    document.querySelectorAll('.export-domain-csv').forEach(button => {
      button.addEventListener('click', async (e) => {
        const domain = e.target.dataset.domain;
        const domainData = await getConsolidatedDomain(domain);
        if (domainData && domainData.emails) {
          const csvContent = "data:text/csv;charset=utf-8," + 
            "Email,Domain\n" + 
            domainData.emails.map(email => `${email},${domain}`).join('\n');
          
          const encodedUri = encodeURI(csvContent);
          const link = document.createElement('a');
          link.setAttribute('href', encodedUri);
          link.setAttribute('download', `${domain}-emails.csv`);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      });
    });
    
  } catch (error) {
    console.error('Error displaying consolidated domains:', error);
    if (consolidatedDomainsContainer) {
      consolidatedDomainsContainer.innerHTML = `<p class="error">Error loading domains: ${error.message}</p>`;
    }
  }
}

/**
 * Create a log entry row for display
 * @param {Object} entry - The log entry data
 * @returns {HTMLTableRowElement} - The created table row
 */
function createLogEntryRow(entry) {
    const row = document.createElement('tr');
    
    // Email cell
    const emailCell = document.createElement('td');
    emailCell.textContent = entry.email;
    row.appendChild(emailCell);
    
    // Status cell
    const statusCell = document.createElement('td');
    statusCell.className = 'status-cell';
    const statusSpan = document.createElement('span');
    statusSpan.className = `status-${entry.status.toLowerCase()}`;
    statusSpan.textContent = entry.status;
    statusCell.appendChild(statusSpan);
    row.appendChild(statusCell);
    
    // Details cell
    const detailsCell = document.createElement('td');
    detailsCell.textContent = entry.detail || '—';
    row.appendChild(detailsCell);
    
    // Source cell
    const sourceCell = document.createElement('td');
    sourceCell.className = 'source-cell';
    if (entry.source) {
        const sourceBadge = document.createElement('span');
        sourceBadge.className = `source-badge ${entry.source}`;
        sourceBadge.textContent = entry.source === 'finder' ? 'Finder' : 'Verifier';
        sourceCell.appendChild(sourceBadge);
    } else {
        sourceCell.textContent = '—';
    }
    row.appendChild(sourceCell);
    
    // Date cell
    const dateCell = document.createElement('td');
    if (entry.timestamp) {
        const date = new Date(entry.timestamp);
        const now = new Date();
        
        // Reset time components to compare just the dates
        const activityDateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const todayDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterdayDateOnly = new Date(todayDateOnly);
        yesterdayDateOnly.setDate(yesterdayDateOnly.getDate() - 1);
        
        if (activityDateOnly.getTime() === todayDateOnly.getTime()) {
            // Today - show time
            dateCell.textContent = `Today, ${date.toLocaleTimeString(undefined, {
                hour: '2-digit',
                minute: '2-digit'
            })}`;
        } else if (activityDateOnly.getTime() === yesterdayDateOnly.getTime()) {
            // Yesterday - show with time
            dateCell.textContent = `Yesterday, ${date.toLocaleTimeString(undefined, {
                hour: '2-digit',
                minute: '2-digit'
            })}`;
        } else {
            // Other date - show full date and time
            dateCell.textContent = formatDate(entry.timestamp);
        }
    } else {
        dateCell.textContent = 'Unknown';
    }
    row.appendChild(dateCell);
    
    return row;
}

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
 * Load all domains and populate domain filter dropdown
 */
async function loadDomainFilters() {
  try {
    if (!domainFilterDropdown) return;
    
    const domains = await getAllDomains();
    
    // Clear existing options except "All Domains"
    while (domainFilterDropdown.options.length > 1) {
      domainFilterDropdown.remove(1);
    }
    
    // Add domain options
    domains.forEach(domain => {
      const option = document.createElement('option');
      option.value = domain.domain;
      option.textContent = `${domain.domain} (${domain.emailCount})`;
      domainFilterDropdown.appendChild(option);
    });
    
    console.log(`Loaded ${domains.length} domains for filtering`);
  } catch (error) {
    console.error('Error loading domain filters:', error);
  }
}

/**
 * Load and display log entries with optional domain filtering
 */
async function loadAndDisplayLog() {
  const logTable = document.getElementById('validationLogTable');
  const logTableBody = document.getElementById('validationLogTableBody');
  const logInitialPlaceholder = document.getElementById('log-initial-placeholder');
  const logCountElement = document.getElementById('logCount');
  const statusFilter = document.getElementById('statusFilter');
  const domainFilter = domainFilterDropdown;
  
  if (!logTableBody || !logTable) return;
  
  try {
    logTableBody.innerHTML = '';
    logInitialPlaceholder.style.display = 'block';
    logTable.style.display = 'none';
    
    let verificationLog;
    
    // Check if we need to filter by domain
    if (domainFilter && domainFilter.value !== 'all') {
      // Get emails for specific domain from Firebase
      verificationLog = await getEmailsByDomain(domainFilter.value);
      logInitialPlaceholder.innerHTML = `<p>Loading log entries for domain: ${domainFilter.value}...</p>`;
    } else {
      // Get all log entries from localStorage
      verificationLog = JSON.parse(localStorage.getItem('leadSparkVerificationLog') || '[]');
      logInitialPlaceholder.innerHTML = '<p>Loading log entries...</p>';
    }
    
    if (verificationLog.length === 0) {
      logInitialPlaceholder.innerHTML = '<p>No verification records found. Verify some emails to see results here!</p>';
      if (logCountElement) logCountElement.textContent = '0 records';
      return;
    }

    // Apply status filter if not set to 'all'
    const statusValue = statusFilter ? statusFilter.value : 'all';
    if (statusValue !== 'all') {
      verificationLog = verificationLog.filter(entry => entry.status === statusValue);
    }

    // Sort log by timestamp (most recent first)
    verificationLog.sort((a, b) => {
      return new Date(b.timestamp) - new Date(a.timestamp);
    });
    
    // Display log entries
    verificationLog.forEach(entry => {
      const row = logTableBody.insertRow();
      row.insertCell().textContent = entry.email;
      
      const statusCell = row.insertCell();
      statusCell.className = 'status-cell';
      const statusSpan = document.createElement('span');
      statusSpan.textContent = entry.status;
      statusSpan.className = `status-${entry.status ? entry.status.toLowerCase() : 'unknown'}`;
      statusCell.appendChild(statusSpan);
      
      row.insertCell().textContent = entry.detail || '';
      
      const sourceCell = row.insertCell();
      if (entry.source) {
        const sourceBadge = document.createElement('span');
        sourceBadge.textContent = entry.source;
        sourceBadge.className = `source-badge source-${entry.source.toLowerCase()}`;
        sourceCell.appendChild(sourceBadge);
      } else {
        sourceCell.textContent = 'N/A';
      }
      
      const dateCell = row.insertCell();
      if (entry.timestamp) {
        const date = new Date(entry.timestamp);
        const now = new Date();
        
        // Reset time components to compare just the dates
        const activityDateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const todayDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterdayDateOnly = new Date(todayDateOnly);
        yesterdayDateOnly.setDate(yesterdayDateOnly.getDate() - 1);
        
        if (activityDateOnly.getTime() === todayDateOnly.getTime()) {
            // Today - show time
            dateCell.textContent = `Today, ${date.toLocaleTimeString(undefined, {
                hour: '2-digit',
                minute: '2-digit'
            })}`;
        } else if (activityDateOnly.getTime() === yesterdayDateOnly.getTime()) {
            // Yesterday - show with time
            dateCell.textContent = `Yesterday, ${date.toLocaleTimeString(undefined, {
                hour: '2-digit',
                minute: '2-digit'
            })}`;
        } else {
            // Other date - show full date and time
            dateCell.textContent = formatDate(entry.timestamp);
        }
      } else {
        dateCell.textContent = 'Unknown';
      }
    });
    
    if (logCountElement) {
      logCountElement.textContent = `${verificationLog.length} records`;
    }
    
    if (verificationLog.length > 0) {
      logTable.style.display = 'table';
      document.getElementById('copyLogButton').style.display = 'inline-block';
    } else {
      logInitialPlaceholder.innerHTML = '<p>No records match the selected filters.</p>';
    }
    
    logInitialPlaceholder.style.display = 'none';
  } catch (error) {
    console.error('Error loading validation log:', error);
    logInitialPlaceholder.innerHTML = `<p>Error loading log: ${error.message}</p>`;
  }
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

    // Initialize domain filter dropdown
    domainFilterDropdown = document.getElementById('domainFilter');
    
    // Add domain filter if it doesn't exist yet
    if (!domainFilterDropdown && document.getElementById('statusFilter')) {
        const statusFilterContainer = document.getElementById('statusFilter').parentNode;
        const domainFilterContainer = document.createElement('div');
        domainFilterContainer.innerHTML = `
            <label for="domainFilter">Filter by Domain:</label>
            <select id="domainFilter">
                <option value="all">All Domains</option>
            </select>
        `;
        statusFilterContainer.parentNode.insertBefore(domainFilterContainer, statusFilterContainer.nextSibling);
        domainFilterDropdown = document.getElementById('domainFilter');
    }
    
    // Add button to toggle consolidated domains view
    const logControlsDiv = document.querySelector('.log-controls');
    if (logControlsDiv && !document.getElementById('toggleConsolidatedView')) {
        const viewButtonDiv = document.createElement('div');
        showConsolidatedViewButton = document.createElement('button');
        showConsolidatedViewButton.id = 'toggleConsolidatedView';
        showConsolidatedViewButton.className = 'btn btn-sm btn-primary';
        showConsolidatedViewButton.textContent = 'Show Domains View';
        showConsolidatedViewButton.addEventListener('click', displayConsolidatedDomains);
        viewButtonDiv.appendChild(showConsolidatedViewButton);
        logControlsDiv.appendChild(viewButtonDiv);
    }
    
    if (domainFilterDropdown) {
        domainFilterDropdown.addEventListener('change', loadAndDisplayLog);
        loadDomainFilters();
    }
}

// Initialize log when DOM loads
document.addEventListener('DOMContentLoaded', initializeValidationLog);

// Add styles for consolidated domains view
function addConsolidatedDomainsStyles() {
  const styleElement = document.createElement('style');
  styleElement.textContent = `
    .consolidated-domains {
      margin-top: 1rem;
    }
    .domains-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1rem;
    }
    .domain-card {
      background-color: var(--color-bg-alt);
      border-radius: var(--border-radius-md);
      padding: 1rem;
      border: 1px solid var(--color-border);
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }
    .domain-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
      border-bottom: 1px solid var(--color-border);
      padding-bottom: 0.5rem;
    }
    .domain-header h3 {
      margin: 0;
      font-size: 16px;
      color: var(--color-text);
    }
    .email-count {
      font-size: 14px;
      color: var(--color-primary);
      font-weight: bold;
    }
    .domain-info {
      display: flex;
      flex-direction: column;
      font-size: 12px;
      color: var(--color-text-muted);
      margin-bottom: 0.5rem;
    }
    .email-list {
      max-height: 150px;
      overflow-y: auto;
      margin-bottom: 0.5rem;
      border: 1px solid var(--color-border);
      border-radius: var(--border-radius-sm);
      padding: 0.5rem;
    }
    .email-list ul {
      list-style-type: none;
      padding: 0;
      margin: 0;
    }
    .email-list li {
      padding: 0.25rem 0;
      border-bottom: 1px solid var(--color-border);
      font-size: 14px;
    }
    .email-list li:last-child {
      border-bottom: none;
    }
    .domain-actions {
      display: flex;
      gap: 0.5rem;
      justify-content: flex-end;
    }
    .loading-indicator, .no-domains, .error {
      text-align: center;
      padding: 2rem;
      font-style: italic;
      color: var(--color-text-muted);
    }
    .error {
      color: var(--color-danger);
    }
  `;
  document.head.appendChild(styleElement);
}

// Add the styles
addConsolidatedDomainsStyles();

export {
    loadAndDisplayLog
}; 