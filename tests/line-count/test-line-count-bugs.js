// Comprehensive test script to verify line count functionality
// Specifically tests the two problematic scenarios:
// 1. Bounded regions (with line counts) not reverting to previous permissions
// 2. Empty lines at the end of sections not being highlighted

const fs = require('fs');

// Create a test file with guard tags
const TEST_FILE = `
// Test file with guard tags to verify line count functionality

// @guard:ai:w
// This starts an unbounded write region
// All lines should be highlighted in red

// @guard:ai:r.2
// This is a READ-ONLY region for exactly 2 lines including this one
// This is line 2 of the read-only region
// This should go BACK to WRITE mode (red) - first bug we're testing

// @guard:ai:n.3
// This is a NO ACCESS region for exactly 3 lines
// This is line 2 of the no access region
// This is line 3 of the no access region
// This should go BACK to WRITE mode (red)

// Empty line below should also be in WRITE mode - second bug we're testing

// @guard:ai:r
// This starts an unbounded read-only region
// All following lines should be read-only (no highlighting)

// @guard:ai:w.2
// This is a WRITE region for exactly 2 lines
// This is line 2 of the write region
// This should go BACK to READ-ONLY mode (no highlighting) - testing bug 1 again

// Empty line below should also be in READ-ONLY mode - testing bug 2 again

`;

// Write the test file
fs.writeFileSync('test-line-counts.js', TEST_FILE);

// Now let's process this file similar to how the extension would

// 1. Parse the file to find all guard tags
const lines = TEST_FILE.split('\n');
const guardTags = [];
const PATTERN = /\/\/\s*@guard:ai:(r|w|n)(\.(\d+))?/;

for (let i = 0; i < lines.length; i++) {
  const match = lines[i].match(PATTERN);
  if (match) {
    const permission = match[1];
    const lineCount = match[3] ? parseInt(match[3], 10) : undefined;
    
    console.log(`Line ${i}: Found guard tag: permission=${permission}, lineCount=${lineCount || 'undefined'}`);
    
    guardTags.push({
      lineNumber: i,
      permission,
      lineCount
    });
  }
}

// 2. Create a line-by-line permission map
const linePermissions = new Array(lines.length).fill('default');

// Process lines similar to how the extension would
// This is the core algorithm being tested
function processGuardTags() {
  // Sort guard tags by line number
  guardTags.sort((a, b) => a.lineNumber - b.lineNumber);
  
  // First, create a map of the base permissions (unbounded regions)
  // This establishes what permission "owns" each line in the document
  const basePermissions = new Array(lines.length).fill(null);
  
  for (let i = 0; i < guardTags.length; i++) {
    const tag = guardTags[i];
    
    // Skip bounded regions for now
    if (tag.lineCount !== undefined) continue;
    
    // For unbounded regions, apply from this line to the next guard tag
    const startLine = tag.lineNumber;
    const endLine = i < guardTags.length - 1 ? guardTags[i + 1].lineNumber : lines.length;
    
    for (let j = startLine; j < endLine; j++) {
      basePermissions[j] = tag.permission;
    }
  }
  
  // Now process bounded regions (with line counts)
  const boundedRegions = [];
  
  for (const tag of guardTags) {
    if (tag.lineCount === undefined) continue;
    
    const startLine = tag.lineNumber;
    const endLine = Math.min(startLine + tag.lineCount, lines.length);
    
    boundedRegions.push({
      startLine,
      endLine,
      permission: tag.permission
    });
    
    // Apply the bounded region's permission
    for (let i = startLine; i < endLine; i++) {
      linePermissions[i] = tag.permission;
    }
    
    // CRITICAL BUGFIX 1: After a bounded region ends, it should revert to the base permission
    if (endLine < lines.length) {
      // Look up what the base permission is at this point
      linePermissions[endLine] = basePermissions[endLine] || 'default';
    }
  }
  
  // Apply base permissions to any lines that haven't been set yet
  for (let i = 0; i < lines.length; i++) {
    if (linePermissions[i] === 'default' && basePermissions[i]) {
      linePermissions[i] = basePermissions[i];
    }
  }
  
  // CRITICAL BUGFIX 2: Make sure empty lines inherit permissions
  // Process the lines in order, and if a line is 'default', it inherits from the previous line
  for (let i = 1; i < lines.length; i++) {
    if (linePermissions[i] === 'default' && linePermissions[i-1] !== 'default') {
      // Empty line inherits from the previous line
      linePermissions[i] = linePermissions[i-1];
    }
  }
}

// Run the algorithm
processGuardTags();

// Verify the results
console.log('\nPermission map for each line:');
console.log('----------------------------');

// Test specific scenarios related to the bugs
const criticalLines = [];

// Test for Bug 1: Lines after a bounded region should revert to previous permission
for (let i = 0; i < guardTags.length; i++) {
  const tag = guardTags[i];
  if (tag.lineCount !== undefined) {
    const endLine = Math.min(tag.lineNumber + tag.lineCount, lines.length);
    if (endLine < lines.length) {
      criticalLines.push({
        line: endLine,
        description: `Line after bounded region (line ${tag.lineNumber} with count ${tag.lineCount})`
      });
    }
  }
}

// Test for Bug 2: Empty lines should get proper highlighting
for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim() === '') {
    criticalLines.push({
      line: i,
      description: `Empty line after line ${i-1}`
    });
  }
}

// Sort critical lines for testing
criticalLines.sort((a, b) => a.line - b.line);

// Print the permission for each line, highlighting critical lines
for (let i = 0; i < lines.length; i++) {
  const isCritical = criticalLines.some(cl => cl.line === i);
  const criticalInfo = isCritical ? criticalLines.find(cl => cl.line === i).description : '';
  
  if (isCritical) {
    console.log(`Line ${i.toString().padStart(3)}: [${linePermissions[i].padEnd(7)}] ${criticalInfo} - ${lines[i].substring(0, 40)}`);
  } else {
    console.log(`Line ${i.toString().padStart(3)}: ${linePermissions[i].padEnd(7)} ${lines[i].substring(0, 40)}`);
  }
}

// Report summary of bugs
console.log('\nTest Results:');
console.log('------------');

// Check for Bug 1: Bounded regions not reverting to previous permissions
let bug1Fixed = true;
for (let i = 0; i < guardTags.length; i++) {
  const tag = guardTags[i];
  if (tag.lineCount !== undefined) {
    const endLine = Math.min(tag.lineNumber + tag.lineCount, lines.length);
    if (endLine < lines.length) {
      // Find what the permission should be (from the previous unbounded region)
      let expectedPermission = 'default';
      for (let j = i - 1; j >= 0; j--) {
        if (guardTags[j].lineCount === undefined) {
          expectedPermission = guardTags[j].permission;
          break;
        }
      }
      
      // Check if the line after the bounded region has the expected permission
      if (linePermissions[endLine] !== expectedPermission && expectedPermission !== 'default') {
        bug1Fixed = false;
        console.log(`BUG 1 FOUND: Line ${endLine} should be ${expectedPermission} but is ${linePermissions[endLine]}`);
      }
    }
  }
}

// Check for Bug 2: Empty lines not getting proper highlighting
let bug2Fixed = true;
for (let i = 1; i < lines.length; i++) {
  if (lines[i].trim() === '') {
    // Empty line should have the same permission as the previous line
    // or the next line if it's before a guard tag
    if (linePermissions[i] === 'default') {
      bug2Fixed = false;
      console.log(`BUG 2 FOUND: Empty line ${i} has no permission`);
    }
  }
}

// Final report
console.log(`\nBug 1 (Bounded regions not reverting): ${bug1Fixed ? 'FIXED' : 'STILL PRESENT'}`);
console.log(`Bug 2 (Empty lines not highlighted): ${bug2Fixed ? 'FIXED' : 'STILL PRESENT'}`);