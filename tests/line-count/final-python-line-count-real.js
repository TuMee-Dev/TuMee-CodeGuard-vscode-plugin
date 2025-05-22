/*
  This is the simplest possible implementation of the line counting feature.
  It removes all complexity and focuses only on what matters.
*/

// Define patterns
const PYTHON_PATTERN = /#\s*@guard:ai:(r|w|n)(\.(\d+))?/i;

// Process a Python file line by line
function processFile(lines) {
  // Store the regions for each line
  const linePermissions = new Array(lines.length).fill('default');
  
  // First pass: Find all guard tags
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(PYTHON_PATTERN);
    
    if (match) {
      const permission = match[1].toLowerCase();
      const lineCount = match[3] ? parseInt(match[3], 10) : undefined;
      
      if (lineCount !== undefined) {
        // This guard has a line count
        // Apply permission to the specified number of lines AFTER the guard line
        const startLine = i + 1; // Skip the guard line itself
        const endLine = Math.min(startLine + lineCount, lines.length);
        
        // Apply permission to these lines
        for (let j = startLine; j < endLine; j++) {
          linePermissions[j] = permission;
        }
      } else {
        // This guard applies until the next guard
        const startLine = i + 1; // Skip guard line itself
        let endLine = lines.length;
        
        // Find the next guard tag
        for (let j = startLine; j < lines.length; j++) {
          if (lines[j].match(PYTHON_PATTERN)) {
            endLine = j;
            break;
          }
        }
        
        // Apply permission to these lines
        for (let j = startLine; j < endLine; j++) {
          linePermissions[j] = permission;
        }
      }
    }
  }
  
  return linePermissions;
}

// Simulate the creation of decorations
function createDecorations(linePermissions) {
  const aiOnlyRanges = []; // For 'w' (red)
  const humanOnlyRanges = []; // For 'n' (green)
  
  // Convert permissions to contiguous ranges
  let currentStart = -1;
  let currentPermission = '';
  
  for (let i = 0; i < linePermissions.length; i++) {
    const permission = linePermissions[i];
    
    if (permission !== currentPermission) {
      // End the previous range if it exists
      if (currentStart >= 0) {
        const range = {
          start: currentStart,
          end: i - 1,
          permission: currentPermission
        };
        
        if (currentPermission === 'w') {
          aiOnlyRanges.push(range);
        } else if (currentPermission === 'n') {
          humanOnlyRanges.push(range);
        }
      }
      
      // Start a new range if needed
      if (permission === 'w' || permission === 'n') {
        currentStart = i;
        currentPermission = permission;
      } else {
        currentStart = -1;
        currentPermission = '';
      }
    }
  }
  
  // Handle the last range if it extends to the end
  if (currentStart >= 0) {
    const range = {
      start: currentStart,
      end: linePermissions.length - 1,
      permission: currentPermission
    };
    
    if (currentPermission === 'w') {
      aiOnlyRanges.push(range);
    } else if (currentPermission === 'n') {
      humanOnlyRanges.push(range);
    }
  }
  
  return { aiOnlyRanges, humanOnlyRanges };
}

module.exports = {
  processFile,
  createDecorations
};