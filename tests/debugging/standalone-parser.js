// Standalone parser to verify guard tag line count handling
// This will debug the exact logic in our extension to ensure it works

const fs = require('fs');

// Read the test file
const pythonFile = fs.readFileSync('./final-python-test.py', 'utf8');
const lines = pythonFile.split('\n');

console.log('PYTHON TEST FILE PARSING');
console.log('========================');

// Pattern specifically for Python files
const PYTHON_GUARD_PATTERN = /#\s*@guard:ai:(r|w|n)(\.(\d+))?/i;

// Store guard regions
const guardRegions = [];

// First pass: Find all guard tags and their regions
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  console.log(`Line ${i}: ${line}`);
  
  // Try to match a guard tag
  const match = line.match(PYTHON_GUARD_PATTERN);
  if (match) {
    const permission = match[1].toLowerCase();
    
    // Extract line count if present
    // In the pattern, group 3 contains the actual count number
    const lineCount = match[3] ? parseInt(match[3], 10) : undefined;
    
    console.log(`  Found guard: permission=${permission}, lineCount=${lineCount || 'undefined'}`);
    
    if (lineCount) {
      // This is a bounded region
      // Starts on the line after the guard and extends for 'lineCount' lines
      const startLine = i + 1; // Start after the guard line
      const endLine = Math.min(startLine + lineCount, lines.length);
      
      guardRegions.push({
        startLine,
        endLine,
        permission,
        type: 'bounded'
      });
      
      console.log(`  Created bounded region: lines ${startLine}-${endLine-1}, permission=${permission}`);
    } else {
      // Unbounded region - extends until the next guard or end of file
      const startLine = i + 1;
      let endLine = lines.length;
      
      // Look for the next guard tag
      for (let j = startLine; j < lines.length; j++) {
        if (lines[j].match(PYTHON_GUARD_PATTERN)) {
          endLine = j;
          break;
        }
      }
      
      guardRegions.push({
        startLine,
        endLine,
        permission,
        type: 'unbounded'
      });
      
      console.log(`  Created unbounded region: lines ${startLine}-${endLine-1}, permission=${permission}`);
    }
  }
}

// Create a map of line permissions
const linePermissions = new Array(lines.length).fill('default');

for (const region of guardRegions) {
  for (let i = region.startLine; i < region.endLine; i++) {
    linePermissions[i] = region.permission;
  }
}

// Print the result
console.log('\nLINE PERMISSIONS:');
console.log('================');
for (let i = 0; i < lines.length; i++) {
  console.log(`Line ${i}: [${linePermissions[i].padEnd(7)}] ${lines[i]}`);
}

// In extension.ts, we would now create decoration ranges based on contiguous permissions
console.log('\nDECORATION RANGES:');
console.log('=================');

const decorationRanges = [];
let currentStart = -1;
let currentPermission = '';

for (let i = 0; i < linePermissions.length; i++) {
  const permission = linePermissions[i];
  
  if (permission !== currentPermission) {
    // End previous range if needed
    if (currentStart >= 0) {
      decorationRanges.push({
        start: currentStart,
        end: i - 1,
        permission: currentPermission
      });
      
      console.log(`Range: lines ${currentStart}-${i - 1}, permission=${currentPermission}`);
    }
    
    // Start new range if needed
    if (permission !== 'default') {
      currentStart = i;
      currentPermission = permission;
    } else {
      currentStart = -1;
      currentPermission = '';
    }
  }
}

// Handle last range if it extends to the end
if (currentStart >= 0) {
  decorationRanges.push({
    start: currentStart,
    end: linePermissions.length - 1,
    permission: currentPermission
  });
  
  console.log(`Range: lines ${currentStart}-${linePermissions.length - 1}, permission=${currentPermission}`);
}