// Test file for guard region coloring in VS Code extension
// This file contains multiple guard regions with different permissions

const { DebugConfigurationProviderTriggerKind } = require("vscode");

// @guard:ai:n
/**
 * Helper function to log messages
 * @param {string} message The message to log
 */
function logMessage(message) {
    console.log(`[TuMee Plugin]: ${message}`);
}

// @guard:ai:w
// This region can be edited by both AI and humans
function aiOnlyFunction() {
    logMessage("This function can only be modified by AI");
    return {
        status: "AI editable",
        permissions: "AI-ED"
    };
}

// @guard:ai:r


// Some whitespace between regions to test preservation



// This region can only be edited by humans
function humanOnlyFunction() {
    logMessage("This function can only be modified by humans");
    
    const data = {
        type: "restricted",
        access: "human-only"
    };
    
    return data;
}


// @guard:ai:w
// This region can be edited by both AI and humans
const sharedConfiguration = {
    name: "TuMee Guard Regions",
    version: "1.0.0",
    settings: {
        highlightColor: "#FFD700",
        debugMode: false,
        showNotifications: true
    }
};



const READ_ONLY_CONFIG = {
    API_KEY: "sample-key-12345",
    MAX_RETRIES: 3,
    TIMEOUT_MS: 5000
};

Object.freeze(READ_ONLY_CONFIG);



// Some more whitespace to test preservation



/**
 * Complex function with multiple lines
 * to test multi-line guard regions
 */
async function fetchGuardedData() {
    try {
        logMessage("Fetching data from API...");
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        return {
            success: true,
            data: {
                guardType: "AI-ED",
                timestamp: new Date().toISOString()
            }
        };
    } catch (error) {
        logMessage(`Error: ${error.message}`);
        return { success: false };
    }
}

// Export functions for VS Code extension
module.exports = {
    aiOnlyFunction,
    humanOnlyFunction,
    sharedConfiguration,
    READ_ONLY_CONFIG,
    fetchGuardedData
};

