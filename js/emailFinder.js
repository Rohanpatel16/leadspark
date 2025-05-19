/**
 * Email Finder Module - Generates and validates email permutations
 */

import { callValidateEmailAPI, mapApiResponseToIsValid, MAX_PARALLEL_REQUESTS_PER_CHUNK } from './api.js';
import { showCopiedFeedback } from './utils.js';
import { storeValidEmail } from './firebase.js';

// Module variables
let bulkFinderForm;
let resultsInitialPlaceholder;
let resultsTable;
let resultsTableBody;
let copyAllValidButton;
let allFoundValidEmailsAcrossSearch = [];

/**
 * Generate email permutations based on name and domain
 * @param {string} firstName - First name
 * @param {string} lastName - Last name
 * @param {string} domain - Domain name
 * @returns {Array<string>} Array of generated email permutations
 */
function generateEmailPermutations(firstName, lastName, domain) {
    if (!firstName || !domain) return [];
    firstName = firstName.toLowerCase().replace(/[^a-z0-9]/g, ''); 
    lastName = lastName ? lastName.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
    domain = domain.toLowerCase();
    
    // Get selected patterns from settings
    const storedSettings = localStorage.getItem('leadSparkSettings');
    let enabledPatterns = [];
    
    if (storedSettings) {
        try {
            const settings = JSON.parse(storedSettings);
            enabledPatterns = settings.emailPatterns || [];
        } catch (e) {
            console.error('Failed to parse stored settings for email patterns:', e);
            enabledPatterns = [
                'first', 'last', 'firstlast', 'first.last', 'first_last', 
                'first-last', 'flast', 'f.last', 'first.l', 'fl'
            ];
        }
    } else {
        enabledPatterns = [
            'first', 'last', 'firstlast', 'first.last', 'first_last', 
            'first-last', 'flast', 'f.last', 'first.l', 'fl'
        ];
    }
    
    const permutations = new Set(); 
    const f = firstName; 
    const l = lastName; 
    const fi = f.charAt(0); 
    const li = l ? l.charAt(0) : '';

    // Only add permutations for enabled patterns
    if (enabledPatterns.includes('first')) permutations.add(`${f}@${domain}`);
    if (l && enabledPatterns.includes('last')) permutations.add(`${l}@${domain}`);
    if (l && enabledPatterns.includes('firstlast')) permutations.add(`${f}${l}@${domain}`);
    if (l && enabledPatterns.includes('lastfirst')) permutations.add(`${l}${f}@${domain}`);
    if (l && enabledPatterns.includes('first.last')) permutations.add(`${f}.${l}@${domain}`);
    if (l && enabledPatterns.includes('last.first')) permutations.add(`${l}.${f}@${domain}`);
    if (l && enabledPatterns.includes('first_last')) permutations.add(`${f}_${l}@${domain}`);
    if (l && enabledPatterns.includes('last_first')) permutations.add(`${l}_${f}@${domain}`);
    if (l && enabledPatterns.includes('first-last')) permutations.add(`${f}-${l}@${domain}`);
    if (l && enabledPatterns.includes('last-first')) permutations.add(`${l}-${f}@${domain}`);
    if (l && enabledPatterns.includes('flast')) permutations.add(`${fi}${l}@${domain}`);
    if (l && enabledPatterns.includes('f.last')) permutations.add(`${fi}.${l}@${domain}`);
    if (l && enabledPatterns.includes('first.l')) permutations.add(`${f}.${li}@${domain}`);
    if (l && enabledPatterns.includes('fl')) permutations.add(`${fi}${li}@${domain}`);
    
    return Array.from(permutations);
}

/**
 * Process email permutations with API validation
 * @param {Array<string>} allPermutations - Array of emails to validate
 * @returns {Promise<Array<Object>>} Validation results
 */
async function processPermutationsWithAPI(allPermutations) {
    const allResults = [];
    // Use MAX_PARALLEL_REQUESTS_PER_CHUNK from API config
    const chunkSize = MAX_PARALLEL_REQUESTS_PER_CHUNK;
    
    for (let i = 0; i < allPermutations.length; i += chunkSize) {
        const chunk = allPermutations.slice(i, i + chunkSize);
        const promises = chunk.map(email => callValidateEmailAPI(email));
        const settledResults = await Promise.allSettled(promises);

        settledResults.forEach(settledResult => {
            if (settledResult.status === 'fulfilled') {
                const apiCallResult = settledResult.value;
                const isValid = mapApiResponseToIsValid(apiCallResult.apiData);
                allResults.push({ email: apiCallResult.originalEmail, isValid: isValid });
                
                // Store valid emails in Firebase
                if (isValid) {
                    storeValidEmail({
                        email: apiCallResult.originalEmail,
                        status: 'Valid',
                        detail: 'Found by Email Finder',
                        timestamp: new Date().toISOString(),
                        source: 'finder'
                    }).catch(err => console.error('Error storing finder email in Firebase:', err));
                }
            } else {
                console.error(`API call rejected for one email in finder:`, settledResult.reason);
            }
        });
        
        if (resultsInitialPlaceholder) {
            resultsInitialPlaceholder.innerHTML = `<p>Processed ${Math.min(i + chunkSize, allPermutations.length)} of ${allPermutations.length} permutations...</p>`;
        }
    }
    return allResults;
}

/**
 * Initialize email finder functionality
 */
function initEmailFinderScripts() {
    bulkFinderForm = document.getElementById('bulkFinderForm');
    resultsInitialPlaceholder = document.getElementById('results-initial-placeholder');
    resultsTable = document.getElementById('resultsTable');
    resultsTableBody = document.getElementById('resultsTableBody');
    copyAllValidButton = document.getElementById('copyAllValidButton');
    allFoundValidEmailsAcrossSearch = []; 

    if (bulkFinderForm) {
        bulkFinderForm.addEventListener('submit', async (event) => { 
            event.preventDefault(); 
            const domain = document.getElementById('finder-domain').value.trim();
            const namesText = document.getElementById('finder-names').value.trim();
            if (!domain || !namesText) { 
                alert('Please enter both a domain and a list of names.'); 
                return; 
            }
            const namesArray = namesText.split('\n').map(name => name.trim()).filter(name => name !== '');
            if (namesArray.length === 0) { 
                alert('Please enter at least one name in the list.'); 
                return; 
            }

            resultsTableBody.innerHTML = ''; 
            resultsTable.style.display = 'none'; 
            copyAllValidButton.style.display = 'none'; 
            allFoundValidEmailsAcrossSearch = []; 
            
            let totalPermutationsToProcess = [];
            for (const fullName of namesArray) {
                const nameParts = fullName.split(' ');
                const firstName = nameParts[0]; 
                const lastName = nameParts.slice(1).join(' '); 
                const permutations = generateEmailPermutations(firstName, lastName, domain);
                totalPermutationsToProcess.push(...permutations.map(p => ({name: fullName, email: p})));
            }

            if (totalPermutationsToProcess.length === 0) {
                resultsInitialPlaceholder.innerHTML = `<p>No permutations generated. Check input.</p>`;
                resultsInitialPlaceholder.style.display = 'block';
                return;
            }
            
            resultsInitialPlaceholder.innerHTML = `<p>Generating & checking ${totalPermutationsToProcess.length} permutations for ${namesArray.length} name(s) at <strong>${domain}</strong> via API... This may take a while.</p>`;
            resultsInitialPlaceholder.style.display = 'block';

            const uniqueEmailsToVerify = [...new Set(totalPermutationsToProcess.map(p => p.email))];
            const apiValidationResults = await processPermutationsWithAPI(uniqueEmailsToVerify);
            
            const resultsByFullName = {};
            namesArray.forEach(name => resultsByFullName[name] = []);

            apiValidationResults.forEach(apiRes => {
                const matchingNameEntries = totalPermutationsToProcess.filter(p => p.email === apiRes.email);
                matchingNameEntries.forEach(entry => {
                    if (apiRes.isValid) {
                        if (!resultsByFullName[entry.name].includes(apiRes.email)) {
                             resultsByFullName[entry.name].push(apiRes.email);
                        }
                        if (!allFoundValidEmailsAcrossSearch.includes(apiRes.email)) {
                            allFoundValidEmailsAcrossSearch.push(apiRes.email);
                        }
                    }
                });
            });
            
            // Add all valid emails to localStorage
            const currentStoredEmails = JSON.parse(localStorage.getItem('leadSparkAllValidEmails') || '[]');
            const newUniqueValidEmails = allFoundValidEmailsAcrossSearch.filter(email => !currentStoredEmails.includes(email));
            if (newUniqueValidEmails.length > 0) {
                currentStoredEmails.push(...newUniqueValidEmails);
                localStorage.setItem('leadSparkAllValidEmails', JSON.stringify(currentStoredEmails));
            }
            
            // Store all valid emails in Firebase with additional metadata
            const validEmailsWithContext = allFoundValidEmailsAcrossSearch.map(email => {
                // Find which name this email belongs to for better context
                const matchingNameEntry = totalPermutationsToProcess.find(p => p.email === email);
                return {
                    email: email,
                    status: 'Valid',
                    detail: `Found by Email Finder for ${matchingNameEntry ? matchingNameEntry.name : 'unknown name'}`,
                    timestamp: new Date().toISOString(),
                    source: 'finder',
                    searchDomain: domain
                };
            });
            
            // Process in batches to avoid overwhelming Firebase
            const storeBatches = async (emailsData, batchSize = 10) => {
                for (let i = 0; i < emailsData.length; i += batchSize) {
                    const batch = emailsData.slice(i, i + batchSize);
                    const promises = batch.map(emailData => storeValidEmail(emailData));
                    await Promise.all(promises).catch(err => console.error('Error storing batch of finder emails:', err));
                }
            };
            
            // Store all valid emails in Firebase in the background
            storeBatches(validEmailsWithContext)
                .then(() => console.log(`Successfully stored ${validEmailsWithContext.length} valid emails from finder in Firebase`))
                .catch(err => console.error('Error in batch storing emails from finder:', err));
            
            for (const fullName of namesArray) {
                const validEmailsForThisName = resultsByFullName[fullName] || [];
                const row = resultsTableBody.insertRow();
                row.insertCell().textContent = fullName;
                const validEmailsCell = row.insertCell();
                
                if (validEmailsForThisName.length > 0) {
                    const ul = document.createElement('ul'); 
                    ul.className = 'email-list';
                    validEmailsForThisName.forEach(email => {
                        const li = document.createElement('li'); 
                        li.className = 'valid-email'; 
                        li.textContent = email; 
                        ul.appendChild(li);
                    });
                    validEmailsCell.appendChild(ul);
                } else { 
                    validEmailsCell.innerHTML = '<em>None found/validated by API</em>'; 
                }

                const actionsCell = row.insertCell();
                if (validEmailsForThisName.length > 0) {
                    const copyBtn = document.createElement('button'); 
                    copyBtn.dataset.originalText = 'Copy';
                    copyBtn.textContent = 'Copy';
                    copyBtn.className = 'btn btn-secondary btn-copy';
                    copyBtn.onclick = (e) => {
                        navigator.clipboard.writeText(validEmailsForThisName.join('\n'))
                            .then(() => showCopiedFeedback(e.target))
                            .catch(err => console.error('Failed to copy emails: ', err));
                    };
                    actionsCell.appendChild(copyBtn);
                } else { 
                    actionsCell.textContent = '-'; 
                }
            }

            resultsInitialPlaceholder.style.display = 'none'; 
            resultsTable.style.display = 'table'; 
            if(allFoundValidEmailsAcrossSearch.length > 0) { 
                copyAllValidButton.style.display = 'inline-block'; 
            }
            
            // Update dashboard stats if function is available
            if (typeof updateDashboardStats === 'function') {
                updateDashboardStats();
            }
        });
    }
    
    if(copyAllValidButton) {
        copyAllValidButton.addEventListener('click', (e) => {
            if(allFoundValidEmailsAcrossSearch.length > 0) {
                navigator.clipboard.writeText(allFoundValidEmailsAcrossSearch.join('\n'))
                    .then(() => showCopiedFeedback(e.target))
                    .catch(err => console.error('Failed to copy all emails: ', err));
            } else { 
                e.target.textContent = "No emails!";
                setTimeout(() => e.target.textContent = e.target.dataset.originalText, 1500);
            }
        });
    }
}

export {
    initEmailFinderScripts,
    generateEmailPermutations
}; 