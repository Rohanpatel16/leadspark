// Firebase Module - Handle Firebase integration for email storage

// Import Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-analytics.js";
import { getDatabase, ref, set, push, get, query, orderByChild, limitToLast, remove, orderByKey, equalTo } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-database.js";

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
    
    // Clean up any test emails after initialization
    cleanupTestEmails();
    
    return true;
  } catch (error) {
    console.error('Error initializing database structure:', error);
    return false;
  }
}

/**
 * Clean up test emails
 * Removes all emails that were created for testing purposes
 */
async function cleanupTestEmails() {
  try {
    // Find test emails (connection tests and access tests)
    const testEmailsQuery = query(
      ref(database, 'validEmails'), 
      orderByChild('email'),
      // Using startAt and endAt to match emails containing test patterns
      startAt('connection-test'),
      endAt('connection-test\uf8ff')
    );
    
    const accessTestQuery = query(
      ref(database, 'validEmails'),
      orderByChild('email'),
      startAt('permission_test'),
      endAt('permission_test\uf8ff')
    );
    
    const testSnap = await get(testEmailsQuery);
    const accessSnap = await get(accessTestQuery);
    
    // Delete all found test emails
    if (testSnap.exists()) {
      testSnap.forEach((childSnapshot) => {
        remove(ref(database, `validEmails/${childSnapshot.key}`))
          .then(() => console.log(`Removed test email: ${childSnapshot.val().email}`))
          .catch(err => console.error('Error removing test email:', err));
      });
    }
    
    if (accessSnap.exists()) {
      accessSnap.forEach((childSnapshot) => {
        remove(ref(database, `validEmails/${childSnapshot.key}`))
          .then(() => console.log(`Removed access test email: ${childSnapshot.val().email}`))
          .catch(err => console.error('Error removing access test email:', err));
      });
    }
    
    // Also remove the test_permission data
    remove(ref(database, 'test_permission'))
      .then(() => console.log('Removed test permission data'))
      .catch(err => console.error('Error removing test permission data:', err));
    
    // Remove the accessTest data
    remove(ref(database, 'accessTest'))
      .then(() => console.log('Removed access test data'))
      .catch(err => console.error('Error removing access test data:', err));
  } catch (error) {
    console.error('Error cleaning up test emails:', error);
  }
}

/**
 * Extract domain from email
 * @param {string} email - The email address
 * @returns {string} The domain part of the email
 */
function getDomainFromEmail(email) {
  if (!email || typeof email !== 'string') return 'unknown';
  const parts = email.split('@');
  return parts.length > 1 ? parts[1] : 'unknown';
}

/**
 * Check if email already exists in Firebase
 * @param {string} email - The email address to check
 * @returns {Promise<boolean>} True if email exists, false otherwise
 */
async function checkEmailExists(email) {
  try {
    // Query by email address
    const emailQuery = query(
      ref(database, 'validEmails'),
      orderByChild('email'),
      equalTo(email)
    );
    
    const snapshot = await get(emailQuery);
    return snapshot.exists();
  } catch (error) {
    console.error('Error checking if email exists:', error);
    return false;
  }
}

/**
 * Store a valid email in Firebase
 * @param {Object} emailData - The email data to store
 * @param {string} emailData.email - The email address
 * @param {string} emailData.status - The verification status
 * @param {string} emailData.detail - Additional details
 * @param {string} emailData.timestamp - When it was verified
 * @returns {Promise} A promise that resolves when the email is stored
 */
async function storeValidEmail(emailData) {
  try {
    // Check if this is a test email
    const isTestEmail = 
      emailData.email.includes('connection-test') || 
      emailData.email.includes('permission_test') ||
      emailData.detail?.includes('test');
    
    // For test emails, store them temporarily
    if (isTestEmail) {
      console.log('Storing test email:', emailData.email);
      const testEmailsRef = ref(database, 'validEmails');
      const newEmailRef = push(testEmailsRef);
      await set(newEmailRef, emailData);
      
      // Schedule cleanup after 30 seconds
      setTimeout(() => {
        remove(newEmailRef)
          .then(() => console.log(`Auto-removed test email: ${emailData.email}`))
          .catch(err => console.error('Error auto-removing test email:', err));
      }, 30000);
      
      return true;
    }
    
    // For regular emails, check if it already exists to avoid duplicates
    const exists = await checkEmailExists(emailData.email);
    if (exists) {
      console.log('Email already exists, not storing duplicate:', emailData.email);
      return false;
    }
    
    // Extract domain for organization
    const domain = getDomainFromEmail(emailData.email);
    
    // Add domain to email data
    const enrichedEmailData = {
      ...emailData,
      domain,
      stored_timestamp: new Date().toISOString()
    };
    
    // Using a proper path structure - 'validEmails'
    const emailsRef = ref(database, 'validEmails');
    
    // First, check if we can access this location
    try {
      await get(emailsRef);
      console.log('Firebase database access successful');
    } catch (accessError) {
      console.error('Firebase database access error:', accessError);
      // Try to write to the root instead to test permissions
      await set(ref(database, 'accessTest'), { timestamp: new Date().toISOString() });
    }
    
    // Continue with storing the email
    const newEmailRef = push(emailsRef);
    await set(newEmailRef, enrichedEmailData);
    console.log('Email stored in Firebase:', enrichedEmailData.email);
    
    // Also update the domain index for faster domain-based queries
    const domainsRef = ref(database, `domains/${domain.replace(/\./g, '_')}`);
    await set(ref(database, `domains/${domain.replace(/\./g, '_')}/${newEmailRef.key}`), {
      email: enrichedEmailData.email,
      timestamp: enrichedEmailData.timestamp,
      stored_timestamp: enrichedEmailData.stored_timestamp
    });
    
    return true;
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
    // Filter out test emails to handle separately
    const testEmails = emailsData.filter(email => 
      email.email.includes('connection-test') || 
      email.email.includes('permission_test') ||
      email.detail?.includes('test')
    );
    
    const realEmails = emailsData.filter(email => 
      !email.email.includes('connection-test') && 
      !email.email.includes('permission_test') &&
      !email.detail?.includes('test')
    );
    
    // Store real emails
    const promises = realEmails.map(email => {
      // For testing purposes, ensure we store all emails
      const emailWithTimestamp = {
        ...email,
        storedAt: new Date().toISOString()
      };
      return storeValidEmail(emailWithTimestamp);
    });
    
    // Handle test emails separately with auto-cleanup
    testEmails.forEach(email => {
      const testEmailsRef = ref(database, 'validEmails');
      const newEmailRef = push(testEmailsRef);
      set(newEmailRef, {
        ...email,
        storedAt: new Date().toISOString(),
        isTest: true
      }).then(() => {
        // Schedule cleanup after 30 seconds
        setTimeout(() => {
          remove(newEmailRef)
            .then(() => console.log(`Auto-removed batch test email: ${email.email}`))
            .catch(err => console.error('Error auto-removing batch test email:', err));
        }, 30000);
      });
    });
    
    await Promise.all(promises);
    console.log(`${realEmails.length} emails stored in Firebase`);
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
        // Skip test emails
        const emailData = childSnapshot.val();
        if (
          !emailData.email.includes('connection-test') && 
          !emailData.email.includes('permission_test') &&
          !emailData.isTest &&
          !emailData.detail?.includes('test')
        ) {
          emails.push({
            id: childSnapshot.key,
            ...emailData
          });
        }
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
 * Retrieve emails by domain
 * @param {string} domain - The domain to filter by
 * @param {number} limit - Maximum number of emails to retrieve (default: 100)
 * @returns {Promise<Array>} A promise that resolves to an array of email objects
 */
async function getEmailsByDomain(domain, limit = 100) {
  try {
    const safeDomain = domain.replace(/\./g, '_'); // Convert dots in domain to underscores
    const domainRef = ref(database, `domains/${safeDomain}`);
    const domainQuery = query(domainRef, orderByChild('timestamp'), limitToLast(limit));
    
    const snapshot = await get(domainQuery);
    
    if (snapshot.exists()) {
      // Get the email keys from the domain index
      const emailKeys = [];
      snapshot.forEach(child => {
        emailKeys.push(child.key);
      });
      
      // Fetch the full email data for each key
      const emailDataPromises = emailKeys.map(key => 
        get(ref(database, `validEmails/${key}`))
      );
      
      const emailSnapshots = await Promise.all(emailDataPromises);
      
      // Compile all email data
      const emails = [];
      emailSnapshots.forEach((snapshot, index) => {
        if (snapshot.exists()) {
          emails.push({
            id: emailKeys[index],
            ...snapshot.val()
          });
        }
      });
      
      // Sort by timestamp in descending order (newest first)
      return emails.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }
    
    return [];
  } catch (error) {
    console.error('Error retrieving emails by domain:', error);
    return [];
  }
}

// Initialize the database structure when this module loads
initDatabaseStructure();

export {
  storeValidEmail,
  storeMultipleValidEmails,
  getValidEmails,
  getEmailsByDomain,
  cleanupTestEmails
}; 