// Complete rewrite of the line count detection and decoration logic
// This uses a completely different approach than before

/**
 * Determine the effective permission for each line in the document by parsing guard tags.
 * This replaces the existing updateCodeDecorations function with a more reliable approach.
 * 
 * @param document The active document
 */
function updateCodeDecorationsNew(document) {
  if (!document) return;
  
  const activeEditor = window.activeTextEditor;
  if (!activeEditor) return;

  const text = document.getText();
  const lines = text.split(/\r?\n/);
  const isMarkdown = document.languageId === 'markdown';
  
  // This will store the effective permission for each line
  const linePermissions = new Array(lines.length).fill('default');
  
  // First pass: Find all guard tags and determine their scope
  const guardRegions = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Match guard tags based on file type
    let match;
    if (isMarkdown) {
      match = line.match(/<!--.*?@guard:ai:(r|w|n)(\.(\d+))?.*?-->/i);
    } else {
      // Try specific patterns for different languages
      if (document.languageId === 'python') {
        match = line.match(/#\s*@guard:ai:(r|w|n)(\.(\d+))?/i);
      } else {
        // Generic pattern for all other languages
        match = line.match(/(?:\/\/|#|--|\/\*|\*)*\s*@guard:ai:(r|w|n)(\.(\d+))?/i);
      }
    }
    
    if (match) {
      const permission = match[1].toLowerCase(); // r, w, or n
      
      // Get line count if present (different capture group based on regex)
      let lineCount;
      if (isMarkdown) {
        lineCount = match[3] ? parseInt(match[3], 10) : undefined;
      } else {
        lineCount = match[2] ? parseInt(match[2], 10) : undefined;
      }
      
      console.log(`Found guard tag at line ${i}: permission=${permission}, lineCount=${lineCount || 'unlimited'}`);
      
      if (lineCount) {
        // Bounded region - add 1 to startLine to skip the tag line itself
        guardRegions.push({
          startLine: i + 1, // Skip the tag line
          endLine: i + 1 + lineCount, // End after the specified number of lines
          permission: permission
        });
        
        console.log(`Created bounded region from line ${i+1} to ${i+1+lineCount-1}, permission=${permission}`);
      } else {
        // Unbounded region - extends until the next guard tag or end of file
        let endLine = lines.length;
        
        // Find the next guard tag
        for (let j = i + 1; j < lines.length; j++) {
          if (isMarkdown) {
            if (lines[j].match(/<!--.*?@guard:ai:(r|w|n).*?-->/i)) {
              endLine = j;
              break;
            }
          } else {
            if (lines[j].match(/(?:\/\/|#|--|\/\*|\*)*\s*@guard:ai:(r|w|n)/i)) {
              endLine = j;
              break;
            }
          }
        }
        
        guardRegions.push({
          startLine: i + 1, // Skip the tag line
          endLine: endLine,
          permission: permission
        });
        
        console.log(`Created unbounded region from line ${i+1} to ${endLine-1}, permission=${permission}`);
      }
    }
  }
  
  // Second pass: Apply permissions to each line
  for (const region of guardRegions) {
    for (let i = region.startLine; i < region.endLine; i++) {
      if (i < linePermissions.length) {
        linePermissions[i] = region.permission;
      }
    }
  }
  
  // Third pass: Create decoration ranges based on permissions
  const aiOnlyRanges = []; // For 'w' permission (red)
  const humanOnlyRanges = []; // For 'n' permission (green)
  let currentRangeStart = -1;
  let currentPermission = '';
  
  for (let i = 0; i < linePermissions.length; i++) {
    const permission = linePermissions[i];
    
    if (permission !== currentPermission) {
      // End the previous range if it exists
      if (currentRangeStart >= 0) {
        const range = new Range(
          new Position(currentRangeStart, 0),
          new Position(i - 1, lines[i - 1] ? lines[i - 1].length : 0)
        );
        
        if (currentPermission === 'w') {
          aiOnlyRanges.push({ range });
        } else if (currentPermission === 'n') {
          humanOnlyRanges.push({ range });
        }
      }
      
      // Start a new range if this is a permission we need to highlight
      if (permission === 'w' || permission === 'n') {
        currentRangeStart = i;
        currentPermission = permission;
      } else {
        currentRangeStart = -1;
        currentPermission = '';
      }
    }
  }
  
  // Handle the last range if it extends to the end
  if (currentRangeStart >= 0) {
    const range = new Range(
      new Position(currentRangeStart, 0),
      new Position(lines.length - 1, lines[lines.length - 1] ? lines[lines.length - 1].length : 0)
    );
    
    if (currentPermission === 'w') {
      aiOnlyRanges.push({ range });
    } else if (currentPermission === 'n') {
      humanOnlyRanges.push({ range });
    }
  }
  
  // Apply the decorations
  activeEditor.setDecorations(aiOnlyDecoration, aiOnlyRanges);
  activeEditor.setDecorations(humanOnlyDecoration, humanOnlyRanges);
  activeEditor.setDecorations(mixedDecoration, []); // Not used but kept for compatibility
  
  console.log(`Applied ${aiOnlyRanges.length} AI write ranges and ${humanOnlyRanges.length} human-only ranges`);
}