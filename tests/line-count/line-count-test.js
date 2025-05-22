// Test file for debugging line count extraction

// First, define our regex patterns
const GUARD_TAG_REGEX = /(?:\/\/|#|--|\/\*|\*)*\s*@guard:ai:(r|w|n)(?:\.(\d+))?/gi;
const LINE_COUNT_REGEX = /(?:\/\/|#|--|\/\*|\*)*\s*@guard:ai:(r|w|n)\.(\d+)/i;
const PYTHON_LINE_COUNT_REGEX = /#\s*@guard:ai:(r|w|n)\.(\d+)/i;

// Test cases
const pythonExample = "# @guard:ai:r.3";
const jsExample = "// @guard:ai:w.5";
const noCountExample = "// @guard:ai:n";

// Test extracting line count from Python example
console.log("\nPython example:", pythonExample);

// Test with specific Python pattern
let pythonMatch = pythonExample.match(PYTHON_LINE_COUNT_REGEX);
console.log("Python-specific match:", pythonMatch);
if (pythonMatch) {
  console.log("  Permission:", pythonMatch[1]);
  console.log("  Line count:", pythonMatch[2]);
}

// Test with generic pattern
const lineCountMatch = pythonExample.match(LINE_COUNT_REGEX);
console.log("Generic line count match:", lineCountMatch);
if (lineCountMatch) {
  console.log("  Permission:", lineCountMatch[1]);
  console.log("  Line count:", lineCountMatch[2]);
}

// Test the global regex we're currently using
let globalMatch = new RegExp(GUARD_TAG_REGEX.source, 'i').exec(pythonExample);
console.log("Current global regex match:", globalMatch);
if (globalMatch) {
  console.log("  Permission:", globalMatch[1]);
  console.log("  Line count:", globalMatch[2]);
}

// Test function that identifies and processes line counts correctly
function parseGuardTag(line) {
  // First try specialized line count patterns
  const pythonMatch = line.match(PYTHON_LINE_COUNT_REGEX);
  if (pythonMatch) {
    return {
      permission: pythonMatch[1],
      lineCount: parseInt(pythonMatch[2], 10),
      type: 'python'
    };
  }
  
  // Then try generic line count pattern
  const lineCountMatch = line.match(LINE_COUNT_REGEX);
  if (lineCountMatch) {
    return {
      permission: lineCountMatch[1],
      lineCount: parseInt(lineCountMatch[2], 10),
      type: 'generic'
    };
  }
  
  // Finally, try the regular guard tag pattern
  const regularMatch = line.match(new RegExp(GUARD_TAG_REGEX.source, 'i'));
  if (regularMatch) {
    return {
      permission: regularMatch[1],
      lineCount: regularMatch[2] ? parseInt(regularMatch[2], 10) : undefined,
      type: 'regular'
    };
  }
  
  return null;
}

// Test the parser function
console.log("\nParser function results:");
console.log("Python example:", parseGuardTag(pythonExample));
console.log("JS example:", parseGuardTag(jsExample));
console.log("No count example:", parseGuardTag(noCountExample));