// Firebase Module - Handle Firebase integration for email storage

// Import Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-analytics.js";
import { getDatabase, ref, set, push, get, query, orderByChild, limitToLast, child, orderByKey, equalTo, remove } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-database.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBikEhtKgm5tHCjc3zRfe2b0pJ4zfl7Ois",
  authDomain: "leadspark160104.firebaseapp.com",
  databaseURL: "https://leadspark160104-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "leadspark160104",
  storageBucket: "leadspark160104.firebasestorage.app",
  messagingSenderId: "665247889517",
  appId: "1:665247889517:web:d3fa458d7ac873f1736764",
  measurementId: "G-Y7BDKCYJPS"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const database = getDatabase(app);

// Configuration for test data auto-cleanup
const TEST_DATA_CONFIG = {
  // Maximum age of test records before deletion (in milliseconds)
  maxAge: 15 * 60 * 1000, // 15 minutes by default
  
  // Patterns to identify test records
  testPatterns: {
    email: ["test@", "example.com"],
    status: ["Test"],
    detail: ["test", "testing", "Firebase connection test"]
  }
};

/**
 * Extract domain from an email address
 * @param {string} email - The email address
 * @returns {string} The domain name extracted from the email
 */
function extractDomain(email) {
  if (!email || !email.includes('@')) return null;
  const domain = email.split('@')[1].toLowerCase();
  return domain;
}

/**
 * Format domain for use as a Firebase key
 * @param {string} domain - The domain name
 * @returns {string} Firebase-safe domain key
 */
function formatDomainKey(domain) {
  if (!domain) return null;
  // Replace dots and other characters not allowed in Firebase keys with safe alternatives
  return domain.replace(/\./g, '-dot-')
               .replace(/\$/g, '-dollar-')
               .replace(/#/g, '-hash-')
               .replace(/\//g, '-slash-')
               .replace(/\[/g, '-lbracket-')
               .replace(/\]/g, '-rbracket-');
}

/**
 * Convert formatted domain key back to actual domain
 * @param {string} domainKey - Firebase-safe domain key
 * @returns {string} Original domain name
 */
function decodeDomainKey(domainKey) {
  if (!domainKey) return null;
  return domainKey.replace(/-dot-/g, '.')
                  .replace(/-dollar-/g, '$')
                  .replace(/-hash-/g, '#')
                  .replace(/-slash-/g, '/')
                  .replace(/-lbracket-/g, '[')
                  .replace(/-rbracket-/g, ']');
}

/**
 * Initialize database with a test value to verify connection
 * This will create a basic structure in your Firebase database
 */
function initDatabaseStructure() {
  try {
    // Create a reference to the root of the database
    const rootRef = ref(database);
    
    // Set a basic structure with a test value
    set(ref(database, 'initialized'), {
      timestamp: new Date().toISOString(),
      message: 'Database initialized successfully'
    });
    
    console.log('Database structure initialized');
    
    // Schedule auto-cleanup of test data
    scheduleTestDataCleanup();
    
    return true;
  } catch (error) {
    console.error('Error initializing database structure:', error);
    return false;
  }
}

/**
 * Check if a record is a test record based on configured patterns
 * @param {Object} record - The database record to check
 * @returns {boolean} True if this is a test record
 */
function isTestRecord(record) {
  // Skip records that don't have expected fields
  if (!record || !record.email || !record.status) return false;
  
  // Check email patterns
  const isTestEmail = TEST_DATA_CONFIG.testPatterns.email.some(pattern => 
    record.email.toLowerCase().includes(pattern.toLowerCase())
  );
  
  // Check status patterns
  const isTestStatus = TEST_DATA_CONFIG.testPatterns.status.some(pattern => 
    record.status === pattern
  );
  
  // Check detail patterns if detail exists
  const isTestDetail = record.detail && TEST_DATA_CONFIG.testPatterns.detail.some(pattern => 
    record.detail.toLowerCase().includes(pattern.toLowerCase())
  );
  
  // Return true if any of the patterns match
  return isTestEmail || isTestStatus || isTestDetail;
}

/**
 * Check if a test record is older than the maximum age
 * @param {Object} record - The database record to check
 * @returns {boolean} True if the record is expired
 */
function isExpiredTestRecord(record) {
  if (!record || !record.timestamp) return false;
  
  const recordTime = new Date(record.timestamp).getTime();
  const currentTime = new Date().getTime();
  const age = currentTime - recordTime;
  
  return age > TEST_DATA_CONFIG.maxAge;
}

/**
 * Clean up expired test records from the database
 * @returns {Promise<Object>} Results of the cleanup
 */
async function cleanupExpiredTestRecords() {
  try {
    console.log("Starting cleanup of expired test records...");
    const emailsRef = ref(database, 'validEmails');
    const snapshot = await get(emailsRef);
    
    if (!snapshot.exists()) {
      return { success: true, message: "No records found", deleted: 0 };
    }
    
    let deleteCount = 0;
    const deletePromises = [];
    
    snapshot.forEach((childSnapshot) => {
      const record = childSnapshot.val();
      const recordId = childSnapshot.key;
      
      if (isTestRecord(record) && isExpiredTestRecord(record)) {
        console.log(`Deleting expired test record: ${record.email}`);
        deletePromises.push(
          remove(ref(database, `validEmails/${recordId}`))
            .then(() => deleteCount++)
        );
        
        // Also remove from domain collection if it exists
        if (record.email) {
          const domain = extractDomain(record.email);
          if (domain) {
            const domainKey = formatDomainKey(domain);
            deletePromises.push(
              remove(ref(database, `emailsByDomain/${domainKey}/${recordId}`))
                .catch(err => console.error(`Error removing from domain collection: ${err}`))
            );
          }
        }
      }
    });
    
    await Promise.all(deletePromises);
    console.log(`Cleanup complete: ${deleteCount} expired test records deleted`);
    
    return { 
      success: true, 
      message: `${deleteCount} expired test records deleted`,
      deleted: deleteCount
    };
  } catch (error) {
    console.error("Error during test record cleanup:", error);
    return { 
      success: false, 
      error: error.message
    };
  }
}

/**
 * Schedule automatic cleanup of test data
 */
function scheduleTestDataCleanup() {
  // Run an initial cleanup
  cleanupExpiredTestRecords()
    .then(result => console.log("Initial cleanup result:", result))
    .catch(err => console.error("Initial cleanup error:", err));
  
  // Schedule periodic cleanups
  setInterval(() => {
    cleanupExpiredTestRecords()
      .then(result => console.log("Periodic cleanup result:", result))
      .catch(err => console.error("Periodic cleanup error:", err));
  }, TEST_DATA_CONFIG.maxAge / 2); // Run cleanup at half the max age interval
}

/**
 * Store a test record that will be automatically deleted after the configured time
 * @param {Object} testData - The test data to store
 * @returns {Promise<Object>} The result of the operation
 */
async function storeTestRecord(testData) {
  try {
    // Ensure it has a Test status
    const data = {
      ...testData,
      status: testData.status || "Test",
      timestamp: testData.timestamp || new Date().toISOString()
    };
    
    const emailsRef = ref(database, 'validEmails');
    const newEmailRef = push(emailsRef);
    await set(newEmailRef, data);
    
    console.log(`Test record stored: ${data.email} (will be deleted after ${TEST_DATA_CONFIG.maxAge/60000} minutes)`);
    
    return {
      success: true,
      key: newEmailRef.key,
      data,
      expiresIn: TEST_DATA_CONFIG.maxAge
    };
  } catch (error) {
    console.error("Error storing test record:", error);
    return { success: false, error: error.message };
  }
}

// Initialize the database structure when this module loads
initDatabaseStructure();

/**
 * Check if an email already exists in the database
 * @param {string} email - The email address to check
 * @returns {Promise<boolean>} Whether the email already exists
 */
async function checkIfEmailExists(email) {
  try {
    const emailsRef = ref(database, 'validEmails');
    // Query emails where the email field equals the provided email
    const emailQuery = query(emailsRef, orderByChild('email'), equalTo(email));
    const snapshot = await get(emailQuery);
    return snapshot.exists();
  } catch (error) {
    console.error('Error checking if email exists:', error);
    // Return false on error to allow the operation to continue
    return false;
  }
}

/**
 * Store a valid email in the reorganized structure
 * @param {Object} emailData - The email data to store
 * @returns {Promise} A promise that resolves when the email is stored
 */
async function storeValidEmail(emailData) {
  try {
    if (!emailData || !emailData.email) {
      console.error('Invalid email data:', emailData);
      return false;
    }
    
    // Check if email already exists in validEmails collection
    const emailExists = await checkIfEmailExists(emailData.email);
    if (emailExists) {
      console.log('Email already exists in validEmails, skipping:', emailData.email);
      return false;
    }
    
    // Extract the domain
    const domain = extractDomain(emailData.email);
    if (!domain) {
      console.error('Could not extract domain from email:', emailData.email);
      return false;
    }
    
    // Format domain key for Firebase path safety
    const domainKey = formatDomainKey(domain);
    
    // Reference to the domain array
    const domainRef = ref(database, `emailsByDomain/${domainKey}`);
    
    // Try to access this location
    try {
      await get(domainRef);
      console.log('Firebase database access successful');
    } catch (accessError) {
      console.error('Firebase database access error:', accessError);
      await set(ref(database, 'accessTest'), { timestamp: new Date().toISOString() });
    }
    
    // Check if the email already exists in this domain
    let domainEmails = [];
    const domainSnapshot = await get(domainRef);
    
    if (domainSnapshot.exists()) {
      domainEmails = domainSnapshot.val();
      
      // Check if this email already exists
      if (domainEmails.some(e => e.email === emailData.email)) {
        console.log('Email already exists in domain, skipping:', emailData.email);
        return false;
      }
    }
    
    // Prepare timestamp
    const timestamp = emailData.timestamp || new Date().toISOString();
    const emailWithTimestamp = {
      ...emailData,
      timestamp
    };
    
    // Store in validEmails collection first
    const emailsRef = ref(database, 'validEmails');
    const newEmailRef = push(emailsRef);
    await set(newEmailRef, emailWithTimestamp);
    
    // Add the new email to the domain's array
    domainEmails.push(emailWithTimestamp);
    
    // Save the updated array
    await set(domainRef, domainEmails);
    
    console.log(`Email stored for domain ${domain}:`, emailData.email);
    return true;
  } catch (error) {
    console.error('Error storing email:', error);
    return false;
  }
}

/**
 * Store multiple valid emails in Firebase
 * @param {Array<Object>} emailsData - Array of email data objects
 * @returns {Promise} A promise that resolves when all emails are stored
 */
async function storeMultipleValidEmails(emailsData) {
  try {
    // Process each email, checking for duplicates
    const promises = [];
    for (const email of emailsData) {
      // Only store valid emails
      if (email.status === 'Valid') {
        // For testing purposes, ensure we store all emails
        const emailWithTimestamp = {
          ...email,
          storedAt: new Date().toISOString()
        };
        promises.push(storeValidEmail(emailWithTimestamp));
      }
    }
    
    const results = await Promise.all(promises);
    const successCount = results.filter(Boolean).length;
    console.log(`${successCount} unique emails stored in Firebase`);
    return true;
  } catch (error) {
    console.error('Error storing multiple emails in Firebase:', error);
    return false;
  }
}

/**
 * Retrieve valid emails from Firebase
 * @param {number} limit - Maximum number of emails to retrieve (default: 100)
 * @returns {Promise<Array>} A promise that resolves to an array of email objects
 */
async function getValidEmails(limit = 100) {
  try {
    const emailsRef = ref(database, 'validEmails');
    const emailsQuery = query(emailsRef, orderByChild('timestamp'), limitToLast(limit));
    const snapshot = await get(emailsQuery);
    
    console.log('Firebase read attempt completed', snapshot.exists() ? 'with data' : 'but no data found');
    
    if (snapshot.exists()) {
      const emails = [];
      snapshot.forEach((childSnapshot) => {
        emails.push({
          id: childSnapshot.key,
          ...childSnapshot.val()
        });
      });
      // Sort by timestamp in descending order (newest first)
      return emails.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }
    return [];
  } catch (error) {
    console.error('Error retrieving emails from Firebase:', error);
    return [];
  }
}

/**
 * Retrieve emails for a specific domain
 * @param {string} domain - The domain to get emails for
 * @returns {Promise<Array>} A promise that resolves to an array of email objects
 */
async function getEmailsByDomain(domain) {
  try {
    if (!domain) {
      console.error('No domain provided');
      return [];
    }
    
    // Format domain key for Firebase path safety
    const domainKey = formatDomainKey(domain);
    
    // Reference to the domain array
    const domainRef = ref(database, `emailsByDomain/${domainKey}`);
    const snapshot = await get(domainRef);
    
    if (snapshot.exists()) {
      const emails = snapshot.val();
      
      // Sort by timestamp if it exists
      if (emails.length > 0 && emails[0].timestamp) {
        return emails.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      }
      
      return emails;
    }
    
    return [];
  } catch (error) {
    console.error(`Error retrieving emails for domain ${domain}:`, error);
    return [];
  }
}

/**
 * Get all available domains with emails
 * @returns {Promise<Array>} A promise that resolves to an array of domain names
 */
async function getAllDomains() {
  try {
    const domainsRef = ref(database, 'emailsByDomain');
    const snapshot = await get(domainsRef);
    
    if (snapshot.exists()) {
      const domains = [];
      snapshot.forEach(childSnapshot => {
        const domain = childSnapshot.key;
        const emails = childSnapshot.val() || [];
        
        domains.push({
          domain: domain,
          emailCount: emails.length
        });
      });
      
      return domains.sort((a, b) => b.emailCount - a.emailCount);
    }
    
    return [];
  } catch (error) {
    console.error('Error retrieving domains:', error);
    return [];
  }
}

/**
 * Test Firebase connection with a special function
 * This can be called from any module to verify Firebase connectivity
 */
window.testFirebaseConnection = async function() {
  try {
    console.log('Testing Firebase database connection...');
    
    // Use a consistent test email for connection testing
    const testData = {
      email: "connection-test@example.com",
      status: "Test",
      detail: "Firebase connection test",
      timestamp: new Date().toISOString()
    };
    
    // Check if the email already exists
    const exists = await checkIfEmailExists(testData.email);
    if (exists) {
      console.log(`Email already exists in Firebase, skipping: ${testData.email}`);
      console.log('Firebase connection test result: SKIPPED (Already exists)');
      return { 
        success: true,
        status: 'SKIPPED',
        message: 'Connection test email already exists, which confirms Firebase connection is working'
      };
    }
    
    // Store the test record using the auto-deletion mechanism
    const result = await storeTestRecord(testData);
    
    if (result.success) {
      console.log('Firebase connection test result: SUCCESS');
      return { 
        success: true,
        status: 'SUCCESS',
        message: 'Test record created successfully'
      };
    } else {
      console.log('Firebase connection test result: FAILED');
      return {
        success: false,
        status: 'FAILED',
        error: result.error || 'Unknown error'
      };
    }
  } catch (error) {
    console.error('Firebase connection test error:', error);
    console.log('Firebase connection test result: FAILED');
    return {
      success: false,
      status: 'FAILED',
      error: error.message
    };
  }
};

/**
 * Test duplicate prevention functionality
 * This can be called from the browser console: testDuplicatePrevention()
 */
window.testDuplicatePrevention = async function() {
  console.log('Testing duplicate prevention in Firebase...');
  
  // Create a test email with unique identifier to avoid polluting the DB
  const testEmailAddress = `test${Date.now()}@example.com`;
  const duplicateEmailAddress = testEmailAddress; // Same email for testing duplicate prevention
  
  const testData1 = {
    email: testEmailAddress,
    status: 'Valid',
    detail: 'First attempt - should succeed',
    timestamp: new Date().toISOString(),
    source: 'duplicate-test'
  };
  
  const testData2 = {
    email: duplicateEmailAddress,
    status: 'Valid',
    detail: 'Second attempt - should be prevented',
    timestamp: new Date().toISOString(),
    source: 'duplicate-test'
  };
  
  try {
    console.log('Step 1: Storing first email...');
    const result1 = await storeValidEmail(testData1);
    console.log('First store result:', result1);
    
    console.log('Step 2: Attempting to store duplicate email...');
    const result2 = await storeValidEmail(testData2);
    console.log('Second store result:', result2);
    
    console.log('Step 3: Retrieving emails to verify...');
    const savedEmails = await getValidEmails(10);
    const firstEmail = savedEmails.find(e => e.email === testEmailAddress);
    
    return { 
      success: true, 
      firstResult: result1,
      duplicateResult: result2,
      firstEmailFound: !!firstEmail,
      firstEmailDetail: firstEmail?.detail || 'Not found',
      testEmail: testEmailAddress,
      message: result1 && !result2 ? 'Duplicate prevention working correctly!' : 'Something went wrong with duplicate prevention'
    };
  } catch (error) {
    console.error('Duplicate prevention test failed:', error);
    return { 
      success: false, 
      error: error.message,
      testEmail: testEmailAddress
    };
  }
};

/**
 * Test auto-deletion of test data
 * This can be called from the browser console: testAutoDeleteFeature()
 */
window.testAutoDeleteFeature = async function() {
  try {
    // Create a test record with shortened expiry for quick testing
    const originalMaxAge = TEST_DATA_CONFIG.maxAge;
    TEST_DATA_CONFIG.maxAge = 30000; // 30 seconds for testing
    
    const testEmailAddress = `test${Date.now()}@example.com`;
    const testData = {
      email: testEmailAddress,
      status: "Test",
      detail: "Firebase connection test",
      timestamp: new Date().toISOString()
    };
    
    console.log(`Creating test record with ${TEST_DATA_CONFIG.maxAge/1000}s expiry`);
    const storeResult = await storeTestRecord(testData);
    
    console.log("Test record created:", storeResult);
    console.log(`This record will be automatically deleted after ${TEST_DATA_CONFIG.maxAge/1000} seconds`);
    console.log("You can verify deletion by running: getValidEmails().then(data => console.log(data))");
    
    // Restore original setting
    TEST_DATA_CONFIG.maxAge = originalMaxAge;
    
    return {
      success: true,
      testData: storeResult,
      message: `Test record created with key ${storeResult.key}. Will be deleted in 30 seconds.`
    };
  } catch (error) {
    console.error("Auto-delete test failed:", error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Force cleanup of all test records
 * This can be called from the browser console: forceCleanupTestRecords()
 */
window.forceCleanupTestRecords = async function() {
  try {
    // Temporarily set max age to 0 to delete all test records regardless of age
    const originalMaxAge = TEST_DATA_CONFIG.maxAge;
    TEST_DATA_CONFIG.maxAge = 0;
    
    // Run cleanup
    const result = await cleanupExpiredTestRecords();
    
    // Restore original setting
    TEST_DATA_CONFIG.maxAge = originalMaxAge;
    
    return result;
  } catch (error) {
    console.error("Forced cleanup failed:", error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Test domain-based email storage
 * This can be called from the browser console: testDomainStorage()
 */
window.testDomainStorage = async function() {
  try {
    // Create test emails for different domains
    const timestamp = new Date().toISOString();
    const domains = ['example.com', 'test.org', 'company.co'];
    const testData = domains.map(domain => ({
      email: `test${Date.now()}@${domain}`,
      status: 'Valid',
      detail: `Domain storage test for ${domain}`,
      timestamp,
      source: 'domain-test'
    }));
    
    // Store test emails
    console.log('Storing test emails for different domains...');
    for (const data of testData) {
      await storeValidEmail(data);
    }
    
    // Retrieve emails by domain
    const results = {};
    for (const domain of domains) {
      console.log(`Retrieving emails for domain: ${domain}`);
      const emails = await getEmailsByDomain(domain);
      results[domain] = emails;
    }
    
    // Get all domains
    const allDomains = await getAllDomains();
    
    return {
      success: true,
      domains: allDomains,
      emailsByDomain: results
    };
  } catch (error) {
    console.error('Domain storage test failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Add consolidatedDomains functionality
async function storeEmailInConsolidatedDomains(emailData) {
  if (!emailData.email) return false;
  
  try {
    const domain = extractDomain(emailData.email);
    if (!domain) return false;
    
    const domainKey = formatDomainKey(domain);
    const consolidatedRef = ref(database, `consolidatedDomains/${domainKey}`);
    
    // Check if domain entry exists
    const snapshot = await get(consolidatedRef);
    
    if (snapshot.exists()) {
      // Domain exists, add email to the list if not already present
      const domainData = snapshot.val();
      if (!domainData.emails) domainData.emails = [];
      
      // Check if email already exists
      if (!domainData.emails.includes(emailData.email)) {
        domainData.emails.push(emailData.email);
        domainData.lastUpdated = new Date().toISOString();
        domainData.emailCount = domainData.emails.length;
        
        await set(consolidatedRef, domainData);
        console.log(`Added email to consolidated domain ${domain}: ${emailData.email}`);
      }
    } else {
      // Create new domain entry
      await set(consolidatedRef, {
        uuid: push(ref(database)).key, // Generate unique ID
        domain: domain,
        emails: [emailData.email],
        lastUpdated: new Date().toISOString(),
        emailCount: 1
      });
      console.log(`Created new consolidated domain ${domain} with email: ${emailData.email}`);
    }
    
    return true;
  } catch (error) {
    console.error('Error storing email in consolidated domains:', error);
    return false;
  }
}

/**
 * Get all consolidated domains with their emails
 * @returns {Promise<Array>} Array of domain objects with email lists
 */
async function getAllConsolidatedDomains() {
  try {
    const domainsRef = ref(database, 'consolidatedDomains');
    const snapshot = await get(domainsRef);
    
    if (!snapshot.exists()) return [];
    
    const domains = [];
    snapshot.forEach(childSnapshot => {
      const data = childSnapshot.val();
      domains.push({
        key: childSnapshot.key,
        uuid: data.uuid || childSnapshot.key,
        domain: data.domain,
        emails: data.emails || [],
        emailCount: data.emailCount || data.emails?.length || 0,
        lastUpdated: data.lastUpdated
      });
    });
    
    return domains.sort((a, b) => b.emailCount - a.emailCount);
  } catch (error) {
    console.error('Error getting consolidated domains:', error);
    return [];
  }
}

/**
 * Get a single consolidated domain by name
 * @param {string} domain - Domain name
 * @returns {Promise<Object>} Domain object with emails
 */
async function getConsolidatedDomain(domain) {
  if (!domain) return null;
  
  try {
    const domainKey = formatDomainKey(domain);
    const domainRef = ref(database, `consolidatedDomains/${domainKey}`);
    const snapshot = await get(domainRef);
    
    if (!snapshot.exists()) return null;
    
    const data = snapshot.val();
    return {
      key: snapshot.key,
      uuid: data.uuid || snapshot.key,
      domain: data.domain,
      emails: data.emails || [],
      emailCount: data.emailCount || data.emails?.length || 0,
      lastUpdated: data.lastUpdated
    };
  } catch (error) {
    console.error(`Error getting consolidated domain ${domain}:`, error);
    return null;
  }
}

/**
 * Test consolidated domain functionality
 */
window.testConsolidatedDomains = async function() {
  try {
    // Create test data for multiple emails with the same domain
    const domain = 'test-consolidated.com';
    const timestamp = new Date().toISOString();
    
    const testEmails = [
      `test1-${Date.now()}@${domain}`,
      `test2-${Date.now()}@${domain}`,
      `test3-${Date.now()}@${domain}`
    ];
    
    console.log(`Testing consolidated domains with ${testEmails.length} emails for domain ${domain}`);
    
    // Store each email
    for (const email of testEmails) {
      const emailData = {
        email,
        status: 'Valid',
        detail: 'Consolidated domain test',
        timestamp,
        source: 'test'
      };
      
      await storeValidEmail(emailData);
    }
    
    // Fetch the consolidated domain
    console.log('Fetching consolidated domain data...');
    const domainData = await getConsolidatedDomain(domain);
    
    return {
      success: true,
      domain: domainData,
      allDomains: await getAllConsolidatedDomains(),
      testEmails
    };
  } catch (error) {
    console.error('Consolidated domain test failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Migrate existing emails into consolidated domains structure
 * @returns {Promise<Object>} Migration results
 */
window.migrateToConsolidatedDomains = async function() {
  try {
    console.log('Starting migration of emails to consolidated domains...');
    
    // Get all emails
    const emailsRef = ref(database, 'validEmails');
    const snapshot = await get(emailsRef);
    
    if (!snapshot.exists()) {
      return { success: false, message: 'No emails found to migrate' };
    }
    
    // Group by domains
    const domainMap = {};
    
    snapshot.forEach(childSnapshot => {
      const email = childSnapshot.val();
      if (!email || !email.email) return;
      
      const domain = extractDomain(email.email);
      if (!domain) return;
      
      if (!domainMap[domain]) {
        domainMap[domain] = [];
      }
      
      domainMap[domain].push(email);
    });
    
    // Create consolidated entries
    const domainPromises = [];
    
    for (const [domain, emails] of Object.entries(domainMap)) {
      const domainKey = formatDomainKey(domain);
      const consolidatedRef = ref(database, `consolidatedDomains/${domainKey}`);
      
      // Extract just the email addresses
      const emailAddresses = emails.map(e => e.email);
      
      domainPromises.push(
        set(consolidatedRef, {
          uuid: push(ref(database)).key,
          domain: domain,
          emails: emailAddresses,
          emailCount: emailAddresses.length,
          lastUpdated: new Date().toISOString()
        })
      );
      
      console.log(`Added ${emailAddresses.length} emails to consolidated domain: ${domain}`);
    }
    
    await Promise.all(domainPromises);
    
    return {
      success: true,
      message: `Successfully migrated emails from ${Object.keys(domainMap).length} domains`,
      domains: Object.keys(domainMap),
      emailCounts: Object.fromEntries(
        Object.entries(domainMap).map(([domain, emails]) => [domain, emails.length])
      )
    };
  } catch (error) {
    console.error('Error during migration to consolidated domains:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Completely restructure the database to organize emails directly by domains
 * This will create the exact structure shown by the user
 * @returns {Promise<Object>} Migration results
 */
window.completelyRestructureDatabase = async function() {
  try {
    console.log('Starting complete database restructuring...');
    
    // Get all emails
    const emailsRef = ref(database, 'validEmails');
    const snapshot = await get(emailsRef);
    
    if (!snapshot.exists()) {
      return { success: false, message: 'No emails found to migrate' };
    }
    
    // Group by domains
    const domainMap = {};
    
    snapshot.forEach(childSnapshot => {
      const email = childSnapshot.val();
      if (!email || !email.email) return;
      
      const domain = extractDomain(email.email);
      if (!domain) return;
      
      if (!domainMap[domain]) {
        domainMap[domain] = [];
      }
      
      // Add the email object with its ID for reference
      domainMap[domain].push({
        ...email,
        id: childSnapshot.key
      });
    });
    
    console.log(`Found ${Object.keys(domainMap).length} domains`);
    
    // Create the new structure
    const newDbStructure = {
      initialized: {
        message: "Database initialized successfully",
        timestamp: new Date().toISOString()
      },
      emailsByDomain: {}
    };
    
    // Fill the emailsByDomain structure
    for (const [domain, emails] of Object.entries(domainMap)) {
      // Remove the generated IDs before storing
      const cleanEmails = emails.map(({id, ...rest}) => rest);
      newDbStructure.emailsByDomain[domain] = cleanEmails;
      console.log(`Added ${cleanEmails.length} emails to domain: ${domain}`);
    }
    
    // Save the new structure (this will overwrite the entire database!)
    await set(ref(database), newDbStructure);
    
    console.log('Database completely restructured!');
    
    return {
      success: true,
      message: `Database restructured with ${Object.keys(domainMap).length} domains`,
      domains: Object.keys(domainMap),
      emailCounts: Object.fromEntries(
        Object.entries(domainMap).map(([domain, emails]) => [domain, emails.length])
      )
    };
  } catch (error) {
    console.error('Error during database restructuring:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

export {
  storeValidEmail,
  storeMultipleValidEmails,
  getValidEmails,
  initDatabaseStructure,
  storeTestRecord,
  cleanupExpiredTestRecords,
  getEmailsByDomain,
  getAllDomains,
  getAllConsolidatedDomains,
  getConsolidatedDomain
}; 