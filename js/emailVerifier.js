/**
 * Email Verifier Module - Verify email addresses with API
 */

import { callValidateEmailAPI, mapApiResponseToStatusDetails, MAX_PARALLEL_REQUESTS_PER_CHUNK } from './api.js';
import { showCopiedFeedback } from './utils.js';
import { storeMultipleValidEmails, getValidEmails } from './firebase.js';

// Module variables
let bulkVerifierForm;
let verifierResultsInitialPlaceholder;
let verifierResultsTable;
let verifierResultsTableBody;
let copyValidVerifiedButton;
let allVerifiedValidEmailsFromCurrentBatch = [];

/**
 * Verify a batch of emails with the API
 * @param {Array<string>} emailsToVerify - Array of emails to validate
 * @returns {Promise<Array<Object>>} Validation results
 */
async function actualVerifyBatchEmails(emailsToVerify) {
    const allResults = [];
    // Use MAX_PARALLEL_REQUESTS_PER_CHUNK from API config
    const chunkSize = MAX_PARALLEL_REQUESTS_PER_CHUNK;
    
    for (let i = 0; i < emailsToVerify.length; i += chunkSize) {
        const chunk = emailsToVerify.slice(i, i + chunkSize);
        const promises = chunk.map(email => callValidateEmailAPI(email));
        const settledResults = await Promise.allSettled(promises);

        settledResults.forEach(settledResult => {
            let email, statusInfo;
            if (settledResult.status === 'fulfilled') {
                const apiCallResult = settledResult.value;
                email = apiCallResult.originalEmail;
                if (apiCallResult.error) {
                    statusInfo = { status: 'Unknown', detail: `API Call Failed: ${apiCallResult.message}` };
                } else {
                    statusInfo = mapApiResponseToStatusDetails(apiCallResult.apiData);
                }
            } else {
                console.error(`API call rejected for one email in verifier:`, settledResult.reason);
                email = "Unknown email (promise rejected)"; 
                statusInfo = { status: 'Unknown', detail: `Promise rejected` }; 
            }
            allResults.push({ 
                email: email, 
                status: statusInfo.status, 
                detail: statusInfo.detail, 
                timestamp: new Date().toISOString() 
            });
        });
        
        if (verifierResultsInitialPlaceholder) {
            verifierResultsInitialPlaceholder.innerHTML = `<p>Verified ${Math.min(i + chunkSize, emailsToVerify.length)} of ${emailsToVerify.length} emails...</p>`;
        }
    }
    return allResults;
}

/**
 * Initialize email verifier functionality
 */
function initEmailVerifierScripts() {
    bulkVerifierForm = document.getElementById('bulkVerifierForm');
    verifierResultsInitialPlaceholder = document.getElementById('verifier-results-initial-placeholder');
    verifierResultsTable = document.getElementById('verifierResultsTable');
    verifierResultsTableBody = document.getElementById('verifierResultsTableBody');
    copyValidVerifiedButton = document.getElementById('copyValidVerifiedButton');
    allVerifiedValidEmailsFromCurrentBatch = [];

    if (bulkVerifierForm) {
        bulkVerifierForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const emailsText = document.getElementById('verifier-emails').value.trim();
            if (!emailsText) { 
                alert('Please enter at least one email to verify.'); 
                return; 
            }
            const emailsArray = [...new Set(emailsText.split('\n').map(email => email.trim()).filter(email => email !== ''))]; 
            if (emailsArray.length === 0) { 
                alert('Please enter valid email addresses.'); 
                return; 
            }

            verifierResultsTableBody.innerHTML = ''; 
            verifierResultsTable.style.display = 'none';
            copyValidVerifiedButton.style.display = 'none'; 
            allVerifiedValidEmailsFromCurrentBatch = [];
            
            verifierResultsInitialPlaceholder.innerHTML = `<p>Verifying ${emailsArray.length} email(s) via API... This may take a while.</p>`;
            verifierResultsInitialPlaceholder.style.display = 'block';

            const verificationResults = await actualVerifyBatchEmails(emailsArray);
            
            // Save verification results to log
            let currentLog = JSON.parse(localStorage.getItem('leadSparkVerificationLog') || '[]');
            currentLog.unshift(...verificationResults); 
            localStorage.setItem('leadSparkVerificationLog', JSON.stringify(currentLog));
            
            // Store valid emails in Firebase
            storeMultipleValidEmails(verificationResults)
              .then(success => console.log('Firebase storage completed:', success ? 'Success' : 'Failed'))
              .catch(err => console.error('Error storing emails in Firebase:', err));

            // Save valid emails locally
            let currentGlobalValidEmails = JSON.parse(localStorage.getItem('leadSparkAllValidEmails') || '[]');
            
            verificationResults.forEach(result => {
                const row = verifierResultsTableBody.insertRow();
                row.insertCell().textContent = result.email;
                const statusCell = row.insertCell(); 
                statusCell.className = 'status-cell';
                const statusSpan = document.createElement('span'); 
                statusSpan.textContent = result.status;
                statusSpan.className = `status-${result.status.toLowerCase()}`; 
                statusCell.appendChild(statusSpan);
                row.insertCell().textContent = result.detail;
                
                if (result.status === 'Valid') {
                    allVerifiedValidEmailsFromCurrentBatch.push(result.email);
                    if (!currentGlobalValidEmails.includes(result.email)) { 
                        currentGlobalValidEmails.push(result.email);
                    }
                    
                    // Add source information when storing in Firebase
                    if (!result.source) {
                        result.source = 'verifier';
                    }
                }
            });
            localStorage.setItem('leadSparkAllValidEmails', JSON.stringify(currentGlobalValidEmails));

            verifierResultsInitialPlaceholder.style.display = 'none'; 
            verifierResultsTable.style.display = 'table';
            
            if (allVerifiedValidEmailsFromCurrentBatch.length > 0) { 
                copyValidVerifiedButton.style.display = 'inline-block'; 
            }
            
            // Update dashboard and log if these functions are available
            if (typeof updateDashboardStats === 'function') updateDashboardStats();
            if (typeof loadAndDisplayValidEmails === 'function') loadAndDisplayValidEmails();
            if (typeof loadRecentActivity === 'function') loadRecentActivity();
            if (typeof loadAndDisplayLog === 'function') loadAndDisplayLog();
        });
    }
    
    if (copyValidVerifiedButton) {
        copyValidVerifiedButton.addEventListener('click', (e) => {
            if (allVerifiedValidEmailsFromCurrentBatch.length > 0) {
                navigator.clipboard.writeText(allVerifiedValidEmailsFromCurrentBatch.join('\n'))
                    .then(() => showCopiedFeedback(e.target))
                    .catch(err => console.error('Failed to copy emails: ', err));
            } else { 
                e.target.textContent = "No emails!";
                setTimeout(() => e.target.textContent = e.target.dataset.originalText, 1500);
            }
        });
    }
}

export {
    initEmailVerifierScripts,
    actualVerifyBatchEmails
}; 

/**
 * Debug function to test Firebase integration
 * This can be called from the browser console: testFirebaseIntegration()
 */
window.testFirebaseIntegration = async function() {
    console.log('Testing Firebase integration...');
    
    const testData = [
        {
            email: 'test@example.com',
            status: 'Valid',
            detail: 'Test email for Firebase integration',
            timestamp: new Date().toISOString()
        },
        {
            email: 'another@test.org',
            status: 'Invalid',
            detail: 'Another test email',
            timestamp: new Date().toISOString()
        }
    ];
    
    try {
        const result = await storeMultipleValidEmails(testData);
        console.log('Firebase test result:', result);
        
        // Try reading back the data
        const savedEmails = await getValidEmails(10);
        console.log('Retrieved emails from Firebase:', savedEmails);
        
        return { success: true, message: 'Firebase test completed' };
    } catch (error) {
        console.error('Firebase test failed:', error);
        return { success: false, error: error.message };
    }
}; 