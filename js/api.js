/**
 * API Service for Email Validation
 */

// Default API URL
let VALIDATE_EMAIL_API_URL = 'https://emailverifiers-backend.bazzigate.com/single-email-varification';
let MAX_PARALLEL_REQUESTS_PER_CHUNK = 50;

/**
 * Call the validate email API for a single email
 * @param {string} email - The email to validate
 * @returns {Promise<Object>} API response data
 */
async function callValidateEmailAPI(email) {
    try {
        // Get API settings
        const storedSettings = localStorage.getItem('leadSparkSettings');
        let apiUrl = VALIDATE_EMAIL_API_URL;
        let apiKey = '';
        let apiProvider = 'bazzigate';
        
        if (storedSettings) {
            try {
                const settings = JSON.parse(storedSettings);
                apiUrl = settings.apiUrl || apiUrl;
                apiKey = settings.apiKey || '';
                apiProvider = settings.apiProvider || apiProvider;
            } catch (e) {
                console.error('Failed to parse stored settings for API call:', e);
            }
        }
        
        // Construct API URL with or without API key
        let fullApiUrl = `${apiUrl}?email=${encodeURIComponent(email)}`;
        
        // Add API key if needed, based on provider
        if (apiKey) {
            switch (apiProvider) {
                case 'validate-email':
                    fullApiUrl += `&api_key=${encodeURIComponent(apiKey)}`;
                    break;
                case 'supersend':
                    fullApiUrl += `&key=${encodeURIComponent(apiKey)}`;
                    break;
                // Bazzigate doesn't seem to use an API key in the query string
            }
        }
        
        // Set appropriate headers based on provider
        let headers = {};
        switch (apiProvider) {
            case 'validate-email':
                headers = { 'accept': 'application/json' };
                break;
            case 'bazzigate':
                headers = { 'accept': 'application/json' };
                break;
            case 'supersend':
                headers = { 'accept': 'application/json' };
                if (apiKey) {
                    headers['Authorization'] = `Bearer ${apiKey}`;
                }
                break;
        }
        
        const response = await fetch(fullApiUrl, { headers });
        
        if (!response.ok) {
            console.error(`API error for ${email}: ${response.status} ${response.statusText}`);
            try {
                const errorData = await response.json();
                console.error('API error data:', errorData);
                return { error: true, message: errorData.message || `HTTP error ${response.status}`, apiData: null, originalEmail: email };
            } catch (e) {
                 return { error: true, message: `HTTP error ${response.status}`, apiData: null, originalEmail: email };
            }
        }
        const data = await response.json();
        return { error: false, apiData: data, originalEmail: email };
    } catch (error) {
        console.error(`Network or other error validating ${email}:`, error);
        return { error: true, message: error.message || 'Network error', apiData: null, originalEmail: email };
    }
}

/**
 * Maps API response to a boolean indicating if the email is valid
 * @param {Object} apiResponseData - The API response data
 * @returns {boolean} Whether the email is considered valid
 */
function mapApiResponseToIsValid(apiResponseData) { // For Email Finder
    if (!apiResponseData) return false;
    
    // Get current API provider from settings
    const storedSettings = localStorage.getItem('leadSparkSettings');
    let apiProvider = 'bazzigate'; // Default
    
    if (storedSettings) {
        try {
            const settings = JSON.parse(storedSettings);
            apiProvider = settings.apiProvider || 'bazzigate';
        } catch (e) {
            console.error('Failed to parse stored settings:', e);
        }
    }
    
    switch (apiProvider) {
        case 'validate-email':
            // validate.email API
            if (!apiResponseData.result) return false;
            const res = apiResponseData.result;
            // Only consider syntax validity and "safe" reachability
            return res.syntax && res.syntax.valid && res.reachable === 'safe';
            
        case 'bazzigate':
            // Bazzigate API returns { res: boolean, email: string }
            return apiResponseData.res === true;
            
        case 'supersend':
            // SuperSend API
            return apiResponseData.valid === true;
            
        default:
            return false;
    }
}

/**
 * Maps API response to status and detailed information
 * @param {Object} apiResponseData - The API response data
 * @returns {Object} Status and details
 */
function mapApiResponseToStatusDetails(apiResponseData) { // For Email Verifier
    if (!apiResponseData) {
        return { status: 'Unknown', detail: 'API error or no result received.' };
    }
    
    // Get current API provider from settings
    const storedSettings = localStorage.getItem('leadSparkSettings');
    let apiProvider = 'bazzigate'; // Default
    
    if (storedSettings) {
        try {
            const settings = JSON.parse(storedSettings);
            apiProvider = settings.apiProvider || 'bazzigate';
        } catch (e) {
            console.error('Failed to parse stored settings:', e);
        }
    }
    
    switch (apiProvider) {
        case 'validate-email':
            // validate.email API
            if (!apiResponseData.result) {
                return { status: 'Unknown', detail: 'API error or no result received.' };
            }
            
            const res = apiResponseData.result;
            let status = 'Unknown'; // Default
            let detailParts = new Set(); // Use Set to avoid duplicate reasons

            // Determine status primarily by 'reachable' field
            if (res.reachable === 'safe') {
                status = 'Valid';
                // Still collect info about the email for details, but don't change Valid status
                if (res.disposable === true) {
                    detailParts.add('Disposable email address.');
                }
                if (res.smtp && res.smtp.is_catch_all === true) {
                    detailParts.add('Domain is catch-all.');
                }
                if (res.domain && !res.domain.spf) {
                    detailParts.add('Domain does not have an SPF record.');
                }
                if (res.domain && res.domain.age < 180) {
                    detailParts.add('Domain age is less than 180 days.');
                }
                if (res.riskScore && res.riskScore.score >= 70) {
                    detailParts.add(`High risk score: ${res.riskScore.score}.`);
                }
            } else if (res.reachable === 'invalid') {
                status = 'Invalid';
                if (res.smtp && res.smtp.is_disabled === true) {
                    detailParts.add('Account disabled or does not exist.');
                } else if (res.smtp && res.smtp.is_deliverable === false) {
                    detailParts.add('Email address not deliverable by SMTP.');
                } else {
                    detailParts.add('Email address is invalid.');
                }
            } else if (res.reachable === 'risky') {
                status = 'Risky';
                if (res.disposable === true) detailParts.add('Disposable email address.');
                if (res.riskScore && res.riskScore.reasons && Array.isArray(res.riskScore.reasons)) {
                    res.riskScore.reasons.forEach(reason => detailParts.add(reason));
                }
            } else if (res.reachable === 'unknown') {
                status = 'Unknown';
                detailParts.add('Email reachability is unknown.');
            }

            // The only case when we should override the reachable field is for syntax errors
            if (!res.syntax || !res.syntax.valid) {
                status = 'Invalid';
                detailParts.clear(); // Clear other reasons if syntax is bad
                detailParts.add('Invalid email syntax.');
            }
            
            let detail = Array.from(detailParts).filter(dp => typeof dp === 'string' && dp.trim() !== '').join('; ');
            if (!detail && status === 'Valid') detail = 'Mailbox appears valid and deliverable.';
            else if (!detail && status === 'Risky') detail = 'Email has risk factors identified.';
            else if (!detail && status === 'Unknown') detail = 'Could not conclusively determine status.';
            else if (!detail && status === 'Invalid') detail = 'Email is invalid or undeliverable.';
            
            return { status, detail: detail || "No specific details provided by API." };
            
        case 'bazzigate':
            // Bazzigate API returns simple boolean result
            if (apiResponseData.res === true) {
                return { 
                    status: 'Valid', 
                    detail: 'Email address is valid and deliverable.'
                };
            } else {
                return { 
                    status: 'Invalid', 
                    detail: 'Email address is invalid or undeliverable.'
                };
            }
            
        case 'supersend':
            // SuperSend API
            if (apiResponseData.valid === true) {
                return {
                    status: 'Valid',
                    detail: apiResponseData.message || 'Email address is valid and deliverable.'
                };
            } else {
                // SuperSend has a special case for uncertain results
                if (apiResponseData.message && apiResponseData.message.includes('Uncertain')) {
                    return {
                        status: 'Risky',
                        detail: apiResponseData.message || 'Email validation is uncertain.'
                    };
                } else {
                    return {
                        status: 'Invalid',
                        detail: apiResponseData.message || 'Email address is invalid or undeliverable.'
                    };
                }
            }
            
        default:
            return { status: 'Unknown', detail: 'Unknown API provider.' };
    }
}

/**
 * Update global API variables based on settings
 */
function updateApiConfig() {
    const storedSettings = localStorage.getItem('leadSparkSettings');
    
    if (storedSettings) {
        try {
            const settings = JSON.parse(storedSettings);
            VALIDATE_EMAIL_API_URL = settings.apiUrl || VALIDATE_EMAIL_API_URL;
            MAX_PARALLEL_REQUESTS_PER_CHUNK = parseInt(settings.maxParallelRequests) || MAX_PARALLEL_REQUESTS_PER_CHUNK;
        } catch (e) {
            console.error('Failed to parse stored settings for API configuration:', e);
        }
    }
}

// Export API functions
export {
    VALIDATE_EMAIL_API_URL,
    MAX_PARALLEL_REQUESTS_PER_CHUNK,
    callValidateEmailAPI,
    mapApiResponseToIsValid,
    mapApiResponseToStatusDetails,
    updateApiConfig
}; 