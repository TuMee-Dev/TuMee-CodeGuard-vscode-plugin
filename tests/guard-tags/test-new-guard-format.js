// Test file for new guard region format in VS Code extension
// This file contains multiple guard regions with different permissions using the new format

/**
 * Helper function to log messages
 * @param {string} message The message to log
 */
function logMessage(message) {
    console.log(`[TuMee Plugin]: ${message}`);
}

// @guard:ai:r
// This region can only be read by AI (AI read-only)
function aiReadOnlyFunction() {
    logMessage("This function can be read but not modified by AI");
    return {
        status: "AI read-only",
        permissions: "r"
    };
}


// Some whitespace between regions to test preservation



// @guard:ai:w
// This region can be written by AI (AI can edit)
function aiWritableFunction() {
    logMessage("This function can be modified by AI");
    
    const data = {
        type: "writable",
        access: "ai-write"
    };
    
    return data;
}


// @guard:ai:n
// This region cannot be accessed by AI at all
const noAiAccessConfig = {
    name: "No AI Access",
    version: "1.0.0",
    settings: {
        secretKey: "#8b3ca0f72e9",
        debugMode: false,
        authToken: "private-token-127634"
    }
};



// Some more whitespace to test preservation



// @guard:ai:r
/**
 * Complex function with multiple lines
 * to test multi-line guard regions
 */
async function fetchProtectedData() {
    try {
        logMessage("Fetching secure data from API...");
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        return {
            success: true,
            data: {
                guardType: "AI read-only",
                timestamp: new Date().toISOString()
            }
        };
    } catch (error) {
        logMessage(`Error: ${error.message}`);
        return { success: false };
    }
}

// @guard:ai:w
// Export functions for VS Code extension
module.exports = {
    aiReadOnlyFunction,
    aiWritableFunction,
    noAiAccessConfig,
    fetchProtectedData
};