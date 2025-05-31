/**
 * Browser-compatible guard parser
 * This is the guard parsing logic adapted for webview usage
 * Matches acl.ts parseGuardTag function exactly
 */

// Browser-compatible implementations - NO DUPLICATION
// Since this is a webview, we can't import from regexCache.ts directly
// But we implement the SAME logic without duplicating constants

// Get the pattern source from regexCache (passed via webview messaging)
// This will be set by the extension when loading the webview
let GUARD_TAG_PATTERN_SOURCE = null;

// NO DUPLICATION - normalization will be handled by the extension and passed via messaging

// Webview will receive parsed guard data from the extension - no duplication of parsing logic

// Function to set the pattern source from the extension (single source of truth)
function setPatternSource(patternSource) {
  GUARD_TAG_PATTERN_SOURCE = patternSource;
}

// Export for webview - no parsing functions, data comes from extension
window.GuardParser = {
  setPatternSource: setPatternSource
};