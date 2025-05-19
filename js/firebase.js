// Firebase Module - Handle Firebase integration for email storage

// Import Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-analytics.js";
import { getDatabase, ref, set, push, get, query, orderByChild, limitToLast, child, remove } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-database.js";
import { showFirebaseRulesInstructions } from "./firebase-rules-helper.js";

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

// Make Firebase objects available globally for debugging
window.firebaseApp = app;
window.firebaseDatabase = database;

// Test email prefixes to identify test emails
const TEST_EMAIL_PREFIXES = ['test', 'demo', 'connection-test', 'example', 'sample'];

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

    // Create a test email in the test_emails path
    const testEmailRef = push(ref(database, 'test_emails'));
    set(testEmailRef, {
      email: 'connection-test@example.com',
      status: 'Test',
      detail: 'Firebase connection test',
      timestamp: new Date().toISOString()
    }).catch(error => {
      console.error('Error creating test email entry:', error);
      // If there's an error, it might be due to permissions
      showFirebaseRulesInstructions();
    });
    
    console.log('Database structure initialized');
    return true;
  } catch (error) {
    console.error('Error initializing database structure:', error);
    // Show rules instructions if there's an initialization error
    showFirebaseRulesInstructions();
    return false;
  }
}

// Initialize the database structure when this module loads
initDatabaseStructure();

/**
 * Extract domain from email address
 * @param {string} email - The email address
 * @returns {string} The domain part of the email
 */
function getDomainFromEmail(email) {
  if (!email || typeof email !== 'string') return 'unknown';
  const parts = email.split('@');
  return parts.length === 2 ? parts[1] : 'unknown';
}

/**
 * Normalize email address for comparison (to prevent duplicates)
 * @param {string} email - The email address to normalize
 * @returns {string} Normalized email address
 */
function normalizeEmail(email) {
  if (!email) return '';
  // Convert to lowercase
  return email.toLowerCase().trim();
}

/**
 * Check if an email is a test email
 * @param {string} email - Email to check
 * @returns {boolean} True if it's a test email
 */
function isTestEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const lowerEmail = email.toLowerCase();
  
  // Check for test domains
  if (
    lowerEmail.includes('@example.com') || 
    lowerEmail.includes('@test.') || 
    lowerEmail.includes('@sample.') ||
    lowerEmail.includes('@demo.')
  ) {
    return true;
  }
  
  // Check for test prefixes
  const localPart = lowerEmail.split('@')[0];
  return TEST_EMAIL_PREFIXES.some(prefix => localPart.startsWith(prefix));
}

/**
 * Test whether we have write permissions to our new domain-based structure
 * This will be called before any actual email storage operations
 */
async function testDomainStructureAccess() {
  try {
    // Try to write to a test domain
    const testDomainRef = ref(database, 'domains/test-domain/emails');
    const testEmailRef = push(testDomainRef);
    
    await set(testEmailRef, {
      email: 'permission-test@test-domain.com',
      status: 'Test',
      detail: 'Testing domain-based structure permissions',
      timestamp: new Date().toISOString()
    });
    
    // Clean up after test
    remove(testEmailRef).catch(err => console.log('Cleanup error:', err));
    
    console.log('Domain structure access test passed');
    return true;
  } catch (error) {
    console.error('Domain structure access test failed:', error);
    showFirebaseRulesInstructions();
    return false;
  }
}

// Run the structure test after initialization
testDomainStructureAccess().then(hasAccess => {
  if (hasAccess) {
    console.log('Firebase is properly configured with domain-based structure permissions');
  } else {
    console.warn('Firebase permissions issue detected - see console for instructions');
  }
});

/**
 * Store a valid email in Firebase, organized by domain
 * @param {Object} emailData - The email data to store
 * @param {string} emailData.email - The email address
 * @param {string} emailData.status - The verification status
 * @param {string} emailData.detail - Additional details
 * @param {string} emailData.timestamp - When it was verified
 * @returns {Promise} A promise that resolves when the email is stored
 */
async function storeValidEmail(emailData) {
  try {
    if (!emailData || !emailData.email) {
      console.error('Invalid email data provided');
      return false;
    }
    
    const normalizedEmail = normalizeEmail(emailData.email);
    const emailDomain = getDomainFromEmail(normalizedEmail);
    const isTest = isTestEmail(normalizedEmail);
    
    // Organize by domain: domains/{domain}/emails/{emailId}
    // Or for test emails: test_emails/{emailId}
    const storePath = isTest ? 'test_emails' : `domains/${emailDomain}/emails`;
    
    // Before storing, check if this email already exists in this domain
    const domainEmailsRef = ref(database, storePath);
    
    try {
      const existingEmailsSnapshot = await get(domainEmailsRef);
      
      // Check if the email already exists
      if (existingEmailsSnapshot.exists()) {
        let isDuplicate = false;
        existingEmailsSnapshot.forEach(childSnapshot => {
          const existingEmail = childSnapshot.val();
          if (existingEmail && normalizeEmail(existingEmail.email) === normalizedEmail) {
            isDuplicate = true;
            // Update the timestamp to mark it was found again
            if (!isTest) {
              set(child(domainEmailsRef, childSnapshot.key), {
                ...existingEmail, 
                lastFound: new Date().toISOString(),
                findCount: (existingEmail.findCount || 0) + 1
              });
              console.log(`Email already exists in database, updated timestamp: ${normalizedEmail}`);
            }
            return true; // Break the forEach loop
          }
        });
        
        if (isDuplicate) {
          return true; // Email already exists, no need to add again
        }
      }
      
      // Email doesn't exist, add it
      const newEmailRef = push(domainEmailsRef);
      
      // Add additional metadata
      const enhancedEmailData = {
        ...emailData,
        email: normalizedEmail,
        domain: emailDomain,
        firstFound: emailData.timestamp || new Date().toISOString(),
        lastFound: new Date().toISOString(),
        findCount: 1,
        isTest: isTest
      };
      
      await set(newEmailRef, enhancedEmailData);
      console.log(`Email stored in Firebase (${isTest ? 'TEST' : 'VALID'}): ${normalizedEmail}`);
      
      // For test emails, schedule cleanup
      if (isTest) {
        setTimeout(() => {
          cleanupTestEmails();
        }, 10 * 60 * 1000); // Clean up test emails after 10 minutes
      }
      
      return true;
      
    } catch (accessError) {
      console.error('Firebase database access error:', accessError);
      // Try to write to the root instead to test permissions
      await set(ref(database, 'accessTest'), { timestamp: new Date().toISOString() });
      return false;
    }
  } catch (error) {
    console.error('Error storing email in Firebase:', error);
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
    // Filter valid emails and prepare for storage
    const validEmails = emailsData.filter(email => email.status === 'Valid');
    
    // Remove duplicates before sending to Firebase (based on normalized email)
    const uniqueEmails = [];
    const seenEmails = new Set();
    
    validEmails.forEach(email => {
      const normalized = normalizeEmail(email.email);
      if (!seenEmails.has(normalized)) {
        seenEmails.add(normalized);
        uniqueEmails.push({
          ...email,
          storedAt: new Date().toISOString()
        });
      }
    });
    
    // Store each email (the storeValidEmail function will handle domain organization)
    const promises = uniqueEmails.map(emailData => storeValidEmail(emailData));
    
    await Promise.all(promises);
    console.log(`${uniqueEmails.length} valid emails stored in Firebase`);
    return true;
  } catch (error) {
    console.error('Error storing multiple emails in Firebase:', error);
    return false;
  }
}

/**
 * Clean up test emails that are older than a certain threshold
 * @returns {Promise<boolean>} Success status
 */
async function cleanupTestEmails() {
  try {
    console.log('Cleaning up test emails...');
    const testEmailsRef = ref(database, 'test_emails');
    const snapshot = await get(testEmailsRef);
    
    if (!snapshot.exists()) {
      console.log('No test emails to clean up');
      return true;
    }
    
    let cleanupCount = 0;
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);
    
    const cleanupPromises = [];
    
    snapshot.forEach(childSnapshot => {
      const emailData = childSnapshot.val();
      if (emailData) {
        const storedTime = new Date(emailData.timestamp || emailData.firstFound || 0);
        // Remove if older than 1 hour
        if (storedTime < oneHourAgo) {
          cleanupPromises.push(remove(child(testEmailsRef, childSnapshot.key)));
          cleanupCount++;
        }
      }
    });
    
    await Promise.all(cleanupPromises);
    console.log(`Cleaned up ${cleanupCount} test emails`);
    return true;
  } catch (error) {
    console.error('Error cleaning up test emails:', error);
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
    // Get all domain folders
    const domainsRef = ref(database, 'domains');
    const domainsSnapshot = await get(domainsRef);
    
    if (!domainsSnapshot.exists()) {
      console.log('No domains found in Firebase');
      return [];
    }
    
    const allEmails = [];
    
    // Process each domain
    const domainPromises = [];
    domainsSnapshot.forEach(domainSnapshot => {
      const domainKey = domainSnapshot.key;
      const emailsRef = ref(database, `domains/${domainKey}/emails`);
      
      // Get emails for this domain
      const promise = get(emailsRef).then(emailsSnapshot => {
        if (emailsSnapshot.exists()) {
          emailsSnapshot.forEach(emailSnapshot => {
            allEmails.push({
              id: emailSnapshot.key,
              domain: domainKey,
              ...emailSnapshot.val()
            });
          });
        }
      }).catch(err => {
        console.error(`Error getting emails for domain ${domainKey}:`, err);
      });
      
      domainPromises.push(promise);
    });
    
    // Wait for all domain email retrievals to complete
    await Promise.all(domainPromises);
    
    console.log(`Retrieved ${allEmails.length} emails from all domains`);
    
    // Sort by timestamp in descending order (newest first) and limit
    const sortedEmails = allEmails
      .sort((a, b) => new Date(b.timestamp || b.lastFound) - new Date(a.timestamp || a.lastFound))
      .slice(0, limit);
    
    return sortedEmails;
  } catch (error) {
    console.error('Error retrieving emails from Firebase:', error);
    return [];
  }
}

/**
 * Get email counts by domain
 * @returns {Promise<Object>} Object with domains as keys and counts as values
 */
async function getDomainEmailCounts() {
  try {
    const domainsRef = ref(database, 'domains');
    const domainsSnapshot = await get(domainsRef);
    
    if (!domainsSnapshot.exists()) {
      return {};
    }
    
    const counts = {};
    const countPromises = [];
    
    domainsSnapshot.forEach(domainSnapshot => {
      const domainKey = domainSnapshot.key;
      const emailsRef = ref(database, `domains/${domainKey}/emails`);
      
      const promise = get(emailsRef).then(emailsSnapshot => {
        if (emailsSnapshot.exists()) {
          counts[domainKey] = Object.keys(emailsSnapshot.val()).length;
        } else {
          counts[domainKey] = 0;
        }
      }).catch(err => {
        console.error(`Error getting count for domain ${domainKey}:`, err);
        counts[domainKey] = 0;
      });
      
      countPromises.push(promise);
    });
    
    await Promise.all(countPromises);
    return counts;
  } catch (error) {
    console.error('Error getting domain email counts:', error);
    return {};
  }
}

// Export functions
export {
  storeValidEmail,
  storeMultipleValidEmails,
  getValidEmails,
  getDomainEmailCounts,
  initDatabaseStructure,
  cleanupTestEmails
}; 