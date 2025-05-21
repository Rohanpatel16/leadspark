/**
 * Email Finder Module - Generates and validates email permutations
 */

import { callValidateEmailAPI, mapApiResponseToIsValid, MAX_PARALLEL_REQUESTS_PER_CHUNK } from './api.js';
import { showCopiedFeedback, extractDomain } from './utils.js';
import { storeValidEmail } from './firebase.js';

// Module variables
let bulkFinderForm;
let resultsInitialPlaceholder;
let resultsTable;
let resultsTableBody;
let copyAllValidButton;
let allFoundValidEmailsAcrossSearch = [];
let catchAllWarningDiv;

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
                
                // We'll store valid emails later after checking for catch-all domains
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
 * Check if all patterns for all names are valid, which might indicate a catch-all domain
 * @param {Array} namesArray - Array of names that were checked
 * @param {Object} resultsByFullName - Object mapping names to arrays of valid emails
 * @param {Array} totalPermutationsToProcess - Array of all email permutations that were checked
 * @returns {boolean} - True if all patterns for all names are valid
 */
function shouldShowCatchAllWarning(namesArray, resultsByFullName, totalPermutationsToProcess) {
    // Get the total number of permutations and valid emails
    const totalPermutations = totalPermutationsToProcess.length;
    
    if (totalPermutations === 0) {
        return false;
    }
    
    // Count how many valid emails we found in total
    let totalValidEmails = 0;
    for (const name of namesArray) {
        totalValidEmails += resultsByFullName[name].length;
    }
    
    // Calculate the ratio of valid emails to total permutations
    const validRatio = totalValidEmails / totalPermutations;
    
    // For a single name
    if (namesArray.length === 1) {
        const name = namesArray[0];
        const validEmailsForName = resultsByFullName[name].length;
        const totalPatternsForName = totalPermutationsToProcess.filter(p => p.name === name).length;
        
        // If at least 5 patterns are valid or more than 80% are valid, it's suspicious
        return (validEmailsForName >= 5) || 
               (totalPatternsForName > 2 && validEmailsForName / totalPatternsForName > 0.8);
    } 
    // For multiple names
    else if (namesArray.length >= 2) {
        // Get names with valid emails (at least 3 or 80% of patterns)
        const namesWithSignificantValidEmails = namesArray.filter(name => {
            const validEmails = resultsByFullName[name].length;
            const totalPatterns = totalPermutationsToProcess.filter(p => p.name === name).length;
            return validEmails >= 3 || (totalPatterns > 0 && validEmails / totalPatterns > 0.7);
        });
        
        // If most names have significant valid emails and the overall valid ratio is high
        const mostNamesHaveValidEmails = namesWithSignificantValidEmails.length >= (namesArray.length * 0.6);
        
        return mostNamesHaveValidEmails && validRatio > 0.7;
    }
    
    return false;
}

/**
 * Display a warning about potential catch-all domain
 * @param {string} domain - The domain that might be a catch-all
 * @param {boolean} isSingleName - Whether this is for a single name or multiple names
 */
function displayCatchAllWarning(domain, isSingleName = false) {
    if (!catchAllWarningDiv) {
        return;
    }
    
    const message = isSingleName
        ? `<div class="warning-message">
            <strong>⚠️ Warning:</strong> All or most email patterns for this name are returning as valid. 
            The domain <strong>${domain}</strong> appears to be a catch-all domain that accepts all incoming email addresses.
            <ul>
                <li>These emails are shown for reference but have <strong>not been saved</strong> to your database.</li>
                <li>Catch-all domains will respond positively to all email validation attempts, even for nonexistent addresses.</li>
                <li>Using these emails could result in high bounce rates and harm your sender reputation.</li>
            </ul>
        </div>`
        : `<div class="warning-message">
            <strong>⚠️ Warning:</strong> Multiple names are showing valid email patterns. 
            The domain <strong>${domain}</strong> appears to be a catch-all domain that accepts all incoming email addresses.
            <ul>
                <li>These emails are shown for reference but have <strong>not been saved</strong> to your database.</li>
                <li>Catch-all domains will respond positively to all email validation attempts, even for nonexistent addresses.</li>
                <li>Using these emails could result in high bounce rates and harm your sender reputation.</li>
            </ul>
        </div>`;
    
    catchAllWarningDiv.innerHTML = message;
    catchAllWarningDiv.style.display = 'block';
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
    catchAllWarningDiv = document.getElementById('catch-all-warning');
    allFoundValidEmailsAcrossSearch = []; 

    // Set up domain input handling
    const domainInput = document.getElementById('finder-domain');
    if (domainInput) {
        // Remove helper text element and replace with instant domain extraction
        domainInput.addEventListener('input', function() {
            const inputValue = this.value.trim();
            if (inputValue) {
                const extractedDomain = extractDomain(inputValue);
                if (extractedDomain !== inputValue) {
                    // Instantly replace with extracted domain
                    this.value = extractedDomain;
                }
            }
        });
        
        // Handle paste event specifically
        domainInput.addEventListener('paste', function(e) {
            // Short timeout to let the paste complete
            setTimeout(() => {
                const inputValue = this.value.trim();
                if (inputValue) {
                    const extractedDomain = extractDomain(inputValue);
                    if (extractedDomain !== inputValue) {
                        // Instantly replace with extracted domain
                        this.value = extractedDomain;
                    }
                }
            }, 10);
        });
    }

    if (bulkFinderForm) {
        bulkFinderForm.addEventListener('submit', async (event) => { 
            event.preventDefault(); 
            const domainInput = document.getElementById('finder-domain').value.trim();
            const domain = extractDomain(domainInput);
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
            
            // Hide catch-all warning if it exists
            if (catchAllWarningDiv) {
                catchAllWarningDiv.style.display = 'none';
            }
            
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
            
            // Check if this might be a catch-all domain and display warning if needed
            const isCatchAllDomain = shouldShowCatchAllWarning(namesArray, resultsByFullName, totalPermutationsToProcess);
            if (isCatchAllDomain) {
                displayCatchAllWarning(domain, namesArray.length === 1);
            }
            
            // Only save emails if it's not a catch-all domain
            if (!isCatchAllDomain) {
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
            } else {
                console.log('Emails not saved due to catch-all domain detection');
            }
            
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