/**
 * Settings Management Module
 */

import { updateApiConfig } from './api.js';
import { showCopiedFeedback } from './utils.js';

// Default settings
const defaultSettings = {
    apiUrl: 'https://emailverifiers-backend.bazzigate.com/single-email-varification',
    apiProvider: 'bazzigate',
    apiKey: '',
    maxParallelRequests: 50,
    emailPatterns: [
        'first', 'last', 'firstlast', 'first.last', 'first_last', 
        'first-last', 'flast', 'f.last', 'first.l', 'fl'
    ]
};

let apiSettingsForm;
let apiUrlInput;
let apiKeyInput;
let maxParallelRequestsInput;
let selectAllPatternsBtn;
let deselectAllPatternsBtn;
let resetDefaultSettingsBtn;
let testApiBtn;
let testEmailInput;
let testResults;
let testResultsContent;
let patternCheckboxes;

/**
 * Load settings from localStorage or use defaults
 */
function loadSettings() {
    const storedSettings = localStorage.getItem('leadSparkSettings');
    let settings = defaultSettings;
    
    if (storedSettings) {
        try {
            const parsedSettings = JSON.parse(storedSettings);
            settings = { ...defaultSettings, ...parsedSettings };
        } catch (e) {
            console.error('Failed to parse stored settings:', e);
        }
    }
    
    // Apply loaded settings to form (if form elements exist)
    if (document.getElementById('api-url')) {
        apiUrlInput = document.getElementById('api-url');
        apiKeyInput = document.getElementById('api-key');
        maxParallelRequestsInput = document.getElementById('max-parallel-requests');
        patternCheckboxes = document.querySelectorAll('input[name="email-patterns"]');
        
        apiUrlInput.value = settings.apiUrl || defaultSettings.apiUrl;
        apiKeyInput.value = settings.apiKey || '';
        maxParallelRequestsInput.value = settings.maxParallelRequests || defaultSettings.maxParallelRequests;
        
        // Apply API provider selection
        const apiProvider = settings.apiProvider || defaultSettings.apiProvider;
        const providerRadio = document.getElementById(`api-provider-${apiProvider}`);
        if (providerRadio) {
            providerRadio.checked = true;
        }
        
        // Apply email pattern selections
        patternCheckboxes.forEach(checkbox => {
            checkbox.checked = settings.emailPatterns.includes(checkbox.value);
        });
    }
    
    return settings;
}

/**
 * Update the API URL when provider changes
 */
function updateApiUrlForProvider() {
    if (!apiUrlInput) return;
    
    const apiProviderRadios = document.querySelectorAll('input[name="api-provider"]');
    let selectedProvider = null;
    
    apiProviderRadios.forEach(radio => {
        if (radio.checked) {
            selectedProvider = radio.value;
        }
    });
    
    switch (selectedProvider) {
        case 'validate-email':
            apiUrlInput.value = 'https://api.validate.email/validate';
            break;
        case 'bazzigate':
            apiUrlInput.value = 'https://emailverifiers-backend.bazzigate.com/single-email-varification';
            break;
        case 'supersend':
            apiUrlInput.value = 'https://api.supersend.io/v1/verify-email';
            break;
    }
    
    // Update the global API config
    updateApiConfig();
}

/**
 * Save current form values to localStorage
 */
function saveSettings() {
    if (!apiUrlInput) {
        // Form not loaded yet, return default settings
        return defaultSettings;
    }
    
    const selectedPatterns = Array.from(patternCheckboxes)
        .filter(checkbox => checkbox.checked)
        .map(checkbox => checkbox.value);

    // Get selected API provider
    const apiProviderRadios = document.querySelectorAll('input[name="api-provider"]');
    let selectedApiProvider = defaultSettings.apiProvider;
    apiProviderRadios.forEach(radio => {
        if (radio.checked) {
            selectedApiProvider = radio.value;
        }
    });

    const parallelRequests = parseInt(maxParallelRequestsInput.value) || defaultSettings.maxParallelRequests;
    
    const settings = {
        apiUrl: apiUrlInput.value,
        apiProvider: selectedApiProvider,
        apiKey: apiKeyInput.value,
        maxParallelRequests: parallelRequests,
        emailPatterns: selectedPatterns
    };

    localStorage.setItem('leadSparkSettings', JSON.stringify(settings));
    updateApiConfig();
    
    return settings;
}

/**
 * Initialize settings form functionality
 */
function initSettingsPageScripts() {
    apiSettingsForm = document.getElementById('apiSettingsForm');
    apiUrlInput = document.getElementById('api-url');
    apiKeyInput = document.getElementById('api-key');
    maxParallelRequestsInput = document.getElementById('max-parallel-requests');
    selectAllPatternsBtn = document.getElementById('select-all-patterns');
    deselectAllPatternsBtn = document.getElementById('deselect-all-patterns');
    resetDefaultSettingsBtn = document.getElementById('reset-default-settings');
    testApiBtn = document.getElementById('test-api-btn');
    testEmailInput = document.getElementById('test-email');
    testResults = document.getElementById('test-results');
    testResultsContent = document.getElementById('test-results-content');
    patternCheckboxes = document.querySelectorAll('input[name="email-patterns"]');

    // Update max parallel requests immediately when input changes
    if (maxParallelRequestsInput) {
        ['change', 'input', 'keyup'].forEach(eventType => {
            maxParallelRequestsInput.addEventListener(eventType, function() {
                saveSettings();
            });
        });
    }
    
    // Event handlers
    if (apiSettingsForm) {
        apiSettingsForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveSettings();
            alert('Settings saved successfully!');
        });
    }

    if (selectAllPatternsBtn) {
        selectAllPatternsBtn.addEventListener('click', () => {
            patternCheckboxes.forEach(checkbox => checkbox.checked = true);
        });
    }

    if (deselectAllPatternsBtn) {
        deselectAllPatternsBtn.addEventListener('click', () => {
            patternCheckboxes.forEach(checkbox => checkbox.checked = false);
        });
    }

    if (resetDefaultSettingsBtn) {
        resetDefaultSettingsBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to reset all settings to defaults?')) {
                localStorage.removeItem('leadSparkSettings');
                loadSettings();
                alert('Settings reset to defaults.');
            }
        });
    }

    // Test API functionality
    if (testApiBtn && testEmailInput) {
        testApiBtn.addEventListener('click', async () => {
            const email = testEmailInput.value.trim();
            if (!email) {
                alert('Please enter an email to test');
                return;
            }
            
            testApiBtn.textContent = 'Testing...';
            testApiBtn.disabled = true;
            testResults.style.display = 'none';
            
            // Get current settings
            const settings = saveSettings();
            
            try {
                // Construct API URL with or without API key
                let apiUrl = `${settings.apiUrl}?email=${encodeURIComponent(email)}`;
                
                if (settings.apiKey) {
                    const separator = apiUrl.includes('?') ? '&' : '?';
                    apiUrl += `${separator}api_key=${encodeURIComponent(settings.apiKey)}`;
                }
                
                const headers = {};
                if (settings.apiProvider === 'supersend' && settings.apiKey) {
                    headers['Authorization'] = `Bearer ${settings.apiKey}`;
                }
                
                const response = await fetch(apiUrl, { headers });
                const data = await response.json();
                
                testResultsContent.textContent = JSON.stringify(data, null, 2);
                testResults.style.display = 'block';
            } catch (error) {
                testResultsContent.textContent = `Error: ${error.message}`;
                testResults.style.display = 'block';
            } finally {
                testApiBtn.textContent = 'Test API';
                testApiBtn.disabled = false;
            }
        });
    }

    // Add event listeners to API provider radio buttons
    document.querySelectorAll('input[name="api-provider"]').forEach(radio => {
        radio.addEventListener('change', function() {
            updateApiUrlForProvider();
            // Save settings immediately when API provider changes
            saveSettings();
        });
    });

    // Initialize
    loadSettings();
}

// Initialize settings when DOM loads
document.addEventListener('DOMContentLoaded', initSettingsPageScripts);

// Exports
export {
    defaultSettings,
    loadSettings,
    saveSettings,
    updateApiUrlForProvider
}; 