/**
 * Firebase Rules Helper - Debug and manage Firebase rules
 * This is for development purposes to set up and debug rules
 */

/**
 * Generate Firebase Realtime Database rules
 * @returns {Object} Firebase rules object
 */
function generateFirebaseRules() {
  return {
    "rules": {
      ".read": true,  // For development testing only
      ".write": true, // For development testing only
      "initialized": {
        ".read": true,
        ".write": true
      },
      "validEmails": {
        ".indexOn": ["timestamp", "email"],
        ".read": true,
        ".write": true
      },
      "emailsByDomain": {
        ".read": true,
        ".write": true
      }
    }
  };
}

/**
 * Show the generated rules in the console for easy copying
 */
function showRulesInConsole() {
  const rules = generateFirebaseRules();
  console.log("===== FIREBASE RULES =====");
  console.log(JSON.stringify(rules, null, 2));
  console.log("=========================");
  console.log("Copy these rules to your Firebase Realtime Database Rules in the Firebase Console");
  console.log("https://console.firebase.google.com/project/leadspark160104/database/leadspark160104-default-rtdb/rules");
}

// Auto-print rules to console when this script loads
showRulesInConsole();

/**
 * Test Firebase access and rules
 * @returns {Promise<Object>} Test results
 */
async function testFirebaseRules() {
  try {
    const database = window.firebaseDatabase;
    if (!database) {
      return { success: false, error: "Firebase database not available" };
    }

    // Test write access
    const testRef = database.ref("test");
    await testRef.set({
      testValue: "This is a test value",
      timestamp: new Date().toISOString()
    });
    
    // Test read access
    const snapshot = await testRef.get();
    if (snapshot.exists()) {
      return { 
        success: true, 
        message: "Firebase rules test successful", 
        readData: snapshot.val() 
      };
    } else {
      return { success: false, error: "No data available" };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Make functions available globally for testing in the console
window.showFirebaseRules = showRulesInConsole;
window.testFirebaseRules = testFirebaseRules;

/**
 * Create the proper Firebase index structure
 * This is a helper for anyone setting up this project
 */
window.setupFirebaseIndex = function() {
  console.log("For the restructured database, ensure you have the following rules:");
  console.log(`
{
  "rules": {
    ".read": true,
    ".write": true,
    "initialized": {
      ".read": true,
      ".write": true
    },
    "validEmails": {
      ".indexOn": ["timestamp", "email"],
      ".read": true,
      ".write": true
    },
    "emailsByDomain": {
      ".read": true,
      ".write": true
    }
  }
}
  `);
  
  console.log("Instructions to setup Firebase rules:");
  console.log("1. Go to Firebase Console: https://console.firebase.google.com/project/leadspark160104/database");
  console.log("2. Select 'Rules' tab");
  console.log("3. Update the rules to match the structure above");
  console.log("4. Click 'Publish'");
};

export {
  generateFirebaseRules,
  showRulesInConsole,
  testFirebaseRules
}; 