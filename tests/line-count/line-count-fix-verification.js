// This script verifies our line count fix works correctly

// Original pattern that extracts line counts
const GUARD_TAG_REGEX = /(?:\/\/|#|--|\/\*|\*)*\s*@guard:ai:(r|w|n)(?:\.(\d+))?/i;

// Test example - Python file with line counts
const pythonFile = `
# Python Test File
# NO GUARD TAG
print("This line has no guard tag")

# @guard:ai:r.3
print("Line 1: Should be read-only for AI for 3 lines") # Line 5
print("Line 2: Still r state, part of the 3-line block") # Line 6
print("Line 3: Still r state, last line of the 3-line block") # Line 7

print("This line should NOT be r state anymore - back to default") # Line 9

# @guard:ai:w.2
print("Line 1: Should have w state (red highlight) for 2 lines") # Line 12
print("Line 2: Still w state, last line of the 2-line block") # Line 13

print("This line should NOT be w state anymore - back to default") # Line 15
`.trim().split('\n');

console.log("FIXED APPROACH");
console.log("==============");

// Track the current state
const currentState = {
  aiCanEdit: true,      // Default to write access for AI
  humanCanEdit: true,   // Default to write access for humans
  aiNoAccess: false,    // Tracks if AI has no access (for 'n' permission)
  aiWriteAccess: false, // Not using this flag for default state
  startLine: 0,
  lineCount: undefined, // Number of lines this guard applies to (optional)
  savedState: null,     // Previous state to revert to after line count expires
  savedStateLine: 0     // Line where the saved state should be restored
};

const stateByLine = [];

// Process each line with the fix
for (let i = 0; i < pythonFile.length; i++) {
  const line = pythonFile[i];
  
  // Check if we need to restore a saved state due to line count expiration
  if (currentState.lineCount !== undefined && i >= currentState.savedStateLine) {
    console.log(`Line ${i}: RESTORING SAVED STATE`);
    
    // Time to restore the saved state
    if (currentState.savedState) {
      const savedState = currentState.savedState;
      currentState.aiCanEdit = savedState.aiCanEdit;
      currentState.humanCanEdit = savedState.humanCanEdit;
      currentState.aiNoAccess = savedState.aiNoAccess;
      currentState.aiWriteAccess = savedState.aiWriteAccess;
    } else {
      // If no saved state, reset to defaults
      currentState.aiCanEdit = true;     // Default AI to write access
      currentState.humanCanEdit = true;  // Default humans to write access
      currentState.aiNoAccess = false;   // Reset the no access flag
      currentState.aiWriteAccess = false; // Reset the write access flag
    }
    
    // Clear the line count and saved state
    currentState.lineCount = undefined;
    currentState.savedState = null;
  }
  
  // Look for a guard tag in this line
  const match = line.match(GUARD_TAG_REGEX);
  if (match) {
    console.log(`Line ${i}: Found guard tag: ${match[0]}`);
    
    // Extract permission and line count
    const permission = match[1].toLowerCase();
    const lineCount = match[2] ? parseInt(match[2], 10) : undefined;
    
    console.log(`  Permission: ${permission}, Line count: ${lineCount || 'undefined'}`);
    
    // Apply guard tag to the CURRENT line (this is the guard tag line itself)
    // We don't want to highlight this line
    
    // Reset state for the new tag
    currentState.aiCanEdit = true;      // Default AI to write access
    currentState.humanCanEdit = true;   // Default humans to write access
    currentState.aiNoAccess = false;    // Reset the no access flag
    currentState.aiWriteAccess = false; // Reset the write access flag
    
    // If line count is specified, save the current state to revert to later
    if (lineCount) {
      // Save a copy of the current state (before applying the new tag)
      currentState.savedState = {
        aiCanEdit: currentState.aiCanEdit,
        humanCanEdit: currentState.humanCanEdit,
        aiNoAccess: currentState.aiNoAccess,
        aiWriteAccess: currentState.aiWriteAccess
      };
      
      // FIX: Add 1 to the line count to make sure we restore AFTER the count, not on the last line
      console.log(`  Will restore saved state at line ${i + lineCount + 1}`);
      
      // Set when to restore this state (after line count lines)
      currentState.lineCount = lineCount;
      currentState.savedStateLine = i + lineCount + 1; // FIX: Add 1 here
    } else {
      // If no line count, clear any saved state
      currentState.lineCount = undefined;
      currentState.savedState = null;
    }
    
    // Update permissions based on the tag
    if (permission === 'r') {
      currentState.aiCanEdit = false;     // AI can only read
      currentState.humanCanEdit = true;   // Humans can edit
      currentState.aiNoAccess = false;    // Not no access
      currentState.aiWriteAccess = false; // Not write access
    } else if (permission === 'w') {
      currentState.aiCanEdit = true;      // AI can write/edit
      currentState.humanCanEdit = true;   // Humans can edit too
      currentState.aiNoAccess = false;    // Not no access
      currentState.aiWriteAccess = true;  // This is AI write access
    } else if (permission === 'n') {
      currentState.aiCanEdit = false;     // AI has no access
      currentState.humanCanEdit = true;   // Humans can still edit
      currentState.aiNoAccess = true;     // This is AI no access
      currentState.aiWriteAccess = false; // Not write access
    }
  }
  
  // Store the current state for this line
  stateByLine.push({
    line: i,
    text: line,
    state: { ...currentState },
    highlight: currentState.aiWriteAccess ? 'RED' : currentState.aiNoAccess ? 'GREEN' : 'NONE'
  });
}

// Show the resulting state for each line
console.log("\nRESULTING STATE BY LINE (FIXED)");
console.log("=============================");
for (const entry of stateByLine) {
  console.log(`Line ${entry.line}: [${entry.highlight}] ${entry.text}`);
  
  if (entry.state.lineCount !== undefined) {
    console.log(`  Has line count: ${entry.state.lineCount}, restore at line: ${entry.state.savedStateLine}`);
  }
}