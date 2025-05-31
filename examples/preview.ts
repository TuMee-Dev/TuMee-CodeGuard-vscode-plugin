// Mixed Permission Example - Shows current mix pattern
// @guard:ai:r @guard:human:r
const sharedData = await loadSharedConfiguration();
const settings = parseSettings(sharedData);
console.log("Both AI and human can read this");

// @guard:ai:w @guard:human:r
function processDataWithAI(userData) {
    // AI can modify, humans can only read
    return aiModel.enhance(userData);
}

// Individual Permission Examples
// @guard:ai:w
function generateReport(data: ReportData): string {
    const formatted = formatData(data);
    return createReportTemplate(formatted);
}

// @guard:ai:r
const config = await loadConfiguration();
const theme = config.get('theme', 'light');
applyTheme(theme);

// @guard:ai:n
const apiKey = process.env.SECRET_API_KEY;
const dbPassword = process.env.DB_PASSWORD;
const encryptionKey = generateSecureKey();

// @guard:human:w
function handleUserInput(input: UserInput): void {
    validateInput(input);
    processUserAction(input.action, input.data);
}

// @guard:human:r
const userPreferences = getUserPreferences();
const displayLanguage = userPreferences.language || 'en';
initializeUI(displayLanguage);

// @guard:human:n
const privateUserData = await fetchPrivateData();
const personalInfo = decryptUserInfo(privateUserData);
storeSecurely(personalInfo);

// @guard:ai:context
// API Reference: POST /api/reports
// Expected payload: { data: ReportData, format: 'pdf' | 'excel' }
// Returns: { url: string, expiresAt: Date }

// @guard:ai:context:w
// TODO: Update this section with new authentication flow
// Need to document OAuth2 integration steps
// Include examples for refresh token handling
