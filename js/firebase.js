// Firebase Module - Handle Firebase integration for email storage

// Import Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-analytics.js";
import { getDatabase, ref, set, push, get, query, orderByChild, limitToLast } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-database.js";

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
    const emailsRef = ref(database, 'validEmails');
    const newEmailRef = push(emailsRef);
    await set(newEmailRef, emailData);
    console.log('Email stored in Firebase:', emailData.email);
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
    const validEmails = emailsData.filter(email => email.status === 'Valid');
    const promises = validEmails.map(email => storeValidEmail(email));
    await Promise.all(promises);
    console.log(`${validEmails.length} valid emails stored in Firebase`);
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

export {
  storeValidEmail,
  storeMultipleValidEmails,
  getValidEmails
}; 