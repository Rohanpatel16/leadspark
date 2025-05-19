/**
 * Firebase Rules Helper Script
 * 
 * This script is designed to help debug Firebase rules issues.
 * It can be run from the browser console or added to your application.
 */

/**
 * Instructions for updating Firebase Realtime Database rules:
 * 
 * 1. Go to Firebase Console: https://console.firebase.google.com/
 * 2. Select your project "leadspark160104"
 * 3. Click on "Realtime Database" from the left sidebar
 * 4. Go to the "Rules" tab
 * 5. Update your rules to the following:
 * 
 * {
 *   "rules": {
 *     ".read": true,
 *     ".write": true,
 *     "validEmails": {
 *       ".read": true,
 *       ".write": true,
 *       "$email_id": {
 *         ".validate": "newData.hasChildren(['email', 'status', 'timestamp'])"
 *       }
 *     },
 *     "domains": {
 *       ".read": true,
 *       ".write": true,
 *       "$domain": {
 *         ".read": true,
 *         ".write": true,
 *         "emails": {
 *           ".read": true,
 *           ".write": true,
 *           "$email_id": {
 *             ".validate": "newData.hasChildren(['email', 'status'])"
 *           }
 *         }
 *       }
 *     },
 *     "test_emails": {
 *       ".read": true,
 *       ".write": true,
 *       "$email_id": {
 *         ".validate": "newData.hasChildren(['email', 'status'])"
 *       }
 *     },
 *     "initialized": {
 *       ".read": true,
 *       ".write": true
 *     },
 *     "accessTest": {
 *       ".read": true,
 *       ".write": true
 *     }
 *   }
 * }
 * 
 * 6. Click "Publish" to save these rules
 * 
 * Note: These rules are set to public read/write for testing purposes.
 * For production, you should implement proper authentication and security rules.
 */

// This function can be called from the console to check if Firebase is connected
window.checkFirebaseConnection = function() {
    if (window.firebaseApp) {
        console.log("Firebase is initialized!");
        console.log("Configuration:", window.firebaseApp.options);
        return {
            status: "Firebase is connected",
            config: window.firebaseApp.options
        };
    } else {
        console.error("Firebase is not initialized or not available globally");
        return {
            status: "Firebase is NOT connected", 
            error: "Firebase App not found in window object"
        };
    }
};

// This function will check database permissions
window.testDatabasePermissions = async function() {
    try {
        if (!window.firebaseDatabase) {
            console.error("Firebase database not initialized globally");
            return { success: false, error: "Firebase database not available" };
        }
        
        // Import required functions dynamically
        const { ref, set, push, get } = await import("https://www.gstatic.com/firebasejs/11.7.3/firebase-database.js");
        
        // Test write to root
        console.log("Testing write to root...");
        try {
            await set(ref(window.firebaseDatabase, 'test_permission'), { 
                timestamp: new Date().toISOString(),
                message: "Testing write permission to root"
            });
            console.log("✅ Write to root successful");
        } catch (error) {
            console.error("❌ Write to root failed:", error);
            return { success: false, error: error.message, location: "root" };
        }
        
        // Test read from root
        console.log("Testing read from root...");
        try {
            const snapshot = await get(ref(window.firebaseDatabase, 'test_permission'));
            console.log("✅ Read from root successful:", snapshot.exists() ? snapshot.val() : "No data");
        } catch (error) {
            console.error("❌ Read from root failed:", error);
            return { success: false, error: error.message, location: "root read" };
        }
        
        // Test write to validEmails node
        console.log("Testing write to validEmails node...");
        try {
            const validEmailsRef = ref(window.firebaseDatabase, 'validEmails');
            const newEmailRef = push(validEmailsRef);
            await set(newEmailRef, {
                email: "permission_test@example.com",
                status: "Valid",
                detail: "Testing permissions",
                timestamp: new Date().toISOString()
            });
            console.log("✅ Write to validEmails successful");
        } catch (error) {
            console.error("❌ Write to validEmails failed:", error);
            return { success: false, error: error.message, location: "validEmails" };
        }
        
        return { success: true, message: "All permission tests passed" };
    } catch (error) {
        console.error("Error during test:", error);
        return { success: false, error: error.message };
    }
};

// This is the recommended rules structure for the LeadSpark application
const RECOMMENDED_FIREBASE_RULES = `{
  "rules": {
    ".read": true,
    ".write": true,
    "validEmails": {
      ".read": true,
      ".write": true,
      "$email_id": {
        ".validate": "newData.hasChildren(['email', 'status', 'timestamp'])"
      }
    },
    "domains": {
      ".read": true,
      ".write": true,
      "$domain": {
        ".read": true,
        ".write": true,
        "emails": {
          ".read": true,
          ".write": true,
          "$email_id": {
            ".validate": "newData.hasChildren(['email', 'status'])"
          }
        }
      }
    },
    "test_emails": {
      ".read": true,
      ".write": true,
      "$email_id": {
        ".validate": "newData.hasChildren(['email', 'status'])"
      }
    },
    "initialized": {
      ".read": true,
      ".write": true
    },
    "accessTest": {
      ".read": true,
      ".write": true
    }
  }
}`;

/**
 * Show Firebase rules instructions
 */
function showFirebaseRulesInstructions() {
  console.info(`
  ========================================
  FIREBASE RULES SETUP INSTRUCTIONS
  ========================================
  
  It appears you're having trouble writing to your Firebase database.
  This is most likely due to Firebase security rules not being properly configured.
  
  Please copy the following rules to your Firebase console:
  
  ${RECOMMENDED_FIREBASE_RULES}
  
  Steps to update Firebase rules:
  
  1. Go to your Firebase Console: https://console.firebase.google.com/
  2. Select your project (leadspark160104)
  3. In the left navigation, click on "Realtime Database"
  4. Click on the "Rules" tab
  5. Replace the existing rules with the rules shown above
  6. Click "Publish" to save the changes
  
  After setting these rules, refresh this page and try again.
  
  NOTE: These are permissive rules suitable for development.
  For production, you should implement proper authentication and
  more restrictive rules.
  ========================================
  `);
  
  alert('Firebase Rules need to be updated. See console for instructions.');
}

export { showFirebaseRulesInstructions, RECOMMENDED_FIREBASE_RULES };

console.log("Firebase rules helper loaded. You can run checkFirebaseConnection() or testDatabasePermissions() from the console."); 