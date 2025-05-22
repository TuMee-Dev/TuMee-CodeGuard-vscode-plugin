// Focused fix for both bugs in the VS Code extension's guard tag handling
// Bug 1: Bounded regions (with line counts) not reverting to previous permissions
// Bug 2: Empty lines at the end of sections not getting proper highlighting

/**
 * This is the key function that needs to be fixed in extension.ts
 * The bugs are in the bounded region processing logic
 */
function updateCodeDecorations(document) {
  if (!document) return;
  
  const activeEditor = window.activeTextEditor;
  if (!activeEditor) return;

  const text = document.getText();
  const lines = text.split(/\r?\n/);
  const isMarkdown = document.languageId === 'markdown';
  const isPython = document.languageId === 'python';
  
  // Define language-specific patterns - all have line count in capture group 3
  const MARKDOWN_PATTERN = /<!--.*?@guard:ai:(r|w|n)(\.(\d+))?.*?-->/i;
  const PYTHON_PATTERN = /#\s*@guard:ai:(r|w|n)(\.(\d+))?/i;
  const GENERAL_PATTERN = /(?:\/\/|#|--|\/\*|\*)*\s*@guard:ai:(r|w|n)(\.(\d+))?/i;
  
  // Check if the document has any guard tags - if not, clear decorations and exit
  let hasGuardTags = false;
  
  if (isMarkdown) {
    hasGuardTags = text.includes("@guard:ai:") && MARKDOWN_PATTERN.test(text);
  } else if (isPython) {
    hasGuardTags = text.includes("@guard:ai:") && PYTHON_PATTERN.test(text);
  } else {
    hasGuardTags = text.includes("@guard:ai:") && GENERAL_PATTERN.test(text);
  }
  
  if (!hasGuardTags) {
    // No guard tags - clear decorations
    activeEditor.setDecorations(aiOnlyDecoration, []);
    activeEditor.setDecorations(humanOnlyDecoration, []);
    activeEditor.setDecorations(mixedDecoration, []);
    return;
  }
  
  // Direct line-by-line permission mapping
  const linePermissions = new Array(lines.length).fill('default');
  
  // First pass: find all guard tags and store their positions and permissions
  const guardTags = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Match guard tag based on file type
    let match = null;
    if (isMarkdown) {
      match = line.match(MARKDOWN_PATTERN);
    } else if (isPython) {
      match = line.match(PYTHON_PATTERN);
    } else {
      match = line.match(GENERAL_PATTERN);
    }
    
    if (match) {
      const permission = match[1].toLowerCase();
      const lineCount = match[3] ? parseInt(match[3], 10) : undefined;
      
      guardTags.push({
        lineNumber: i,
        permission,
        lineCount
      });
    }
  }
  
  // Process guard tags in order
  if (guardTags.length === 0) {
    // Should never happen due to hasGuardTags check, but just in case
    return;
  }
  
  // First sort guard tags by line number to ensure correct processing order
  guardTags.sort((a, b) => a.lineNumber - b.lineNumber);
  
  // STEP 1: First process all UNBOUNDED regions
  // This establishes the "base" permission state throughout the document
  const basePermissions = new Array(lines.length).fill(null);
  
  for (let i = 0; i < guardTags.length; i++) {
    const tag = guardTags[i];
    
    // Skip bounded regions for now
    if (tag.lineCount !== undefined) continue;
    
    // For unbounded regions, apply from this line to the next guard tag
    const startLine = tag.lineNumber;
    let endLine;
    
    // Find the next guard tag (bounded or unbounded)
    if (i < guardTags.length - 1) {
      endLine = guardTags[i + 1].lineNumber;
    } else {
      endLine = lines.length;
    }
    
    // Apply this permission to all lines in the range
    for (let j = startLine; j < endLine; j++) {
      basePermissions[j] = tag.permission;
      // Also apply to linePermissions as the default state
      linePermissions[j] = tag.permission;
    }
  }
  
  // STEP 2: Determine parent permissions for bounded regions
  // For each bounded region, find which unbounded region it belongs to
  const parentPermissions = new Map();
  
  for (let i = 0; i < guardTags.length; i++) {
    const tag = guardTags[i];
    if (tag.lineCount === undefined) continue; // Skip unbounded regions
    
    // Find the most recent unbounded region permission that applies to this line
    let parentPermission = 'default';
    for (let j = 0; j < guardTags.length; j++) {
      const prevTag = guardTags[j];
      if (prevTag.lineCount === undefined && // Only consider unbounded regions
          prevTag.lineNumber < tag.lineNumber) { // That come before this tag
        // We'll take the latest one that applies
        parentPermission = prevTag.permission;
      }
    }
    
    // Store the parent permission for this bounded region
    parentPermissions.set(tag.lineNumber, parentPermission);
  }
  
  // STEP 3: Now process all BOUNDED regions (with line counts)
  for (const tag of guardTags) {
    if (tag.lineCount === undefined) continue; // Skip unbounded regions
    
    const startLine = tag.lineNumber;
    // BUGFIX: Include the guard tag line itself in the count
    // +1 ensures we count the guard tag line itself as part of the region
    const endLine = Math.min(startLine + tag.lineCount + 1, lines.length);
    
    // Apply the bounded region's permission
    for (let i = startLine; i < endLine; i++) {
      linePermissions[i] = tag.permission;
    }
    
    // BUGFIX 1: After a bounded region ends, revert to the parent permission
    if (endLine < lines.length) {
      // Get the parent permission we determined earlier
      const parentPermission = parentPermissions.get(startLine);
      if (parentPermission) {
        // Apply the parent permission at the end line
        linePermissions[endLine] = parentPermission;
        
        // BUGFIX 2: Also apply to all following lines until the next guard tag
        // This ensures empty lines at the end get proper highlighting
        let nextGuardTagLine = lines.length;
        for (const nextTag of guardTags) {
          if (nextTag.lineNumber > endLine) {
            nextGuardTagLine = nextTag.lineNumber;
            break;
          }
        }
        
        for (let i = endLine + 1; i < nextGuardTagLine; i++) {
          // Don't override lines that are already part of another explicit region
          if (linePermissions[i] === 'default') {
            linePermissions[i] = parentPermission;
          }
        }
      }
    }
  }
  
  // Final pass: Apply base permissions to any lines that haven't been set yet
  for (let i = 0; i < lines.length; i++) {
    if (linePermissions[i] === 'default' && basePermissions[i]) {
      linePermissions[i] = basePermissions[i];
    }
  }
  
  // Now convert the line permissions to decoration ranges
  const aiOnlyRanges = [];   // 'w' permission - AI Write (red)
  const humanOnlyRanges = []; // 'n' permission - AI No Access (green)
  
  // Combine adjacent lines with the same permission into a single range
  let currentStart = -1;
  let currentPermission = '';
  
  for (let i = 0; i < linePermissions.length; i++) {
    const permission = linePermissions[i];
    
    if (permission !== currentPermission) {
      // End previous range if it exists
      if (currentStart >= 0) {
        const range = new Range(
          new Position(currentStart, 0),
          new Position(i - 1, lines[i - 1] ? lines[i - 1].length : 0)
        );
        
        if (currentPermission === 'w') {
          aiOnlyRanges.push({ range });
        } else if (currentPermission === 'n') {
          humanOnlyRanges.push({ range });
        }
      }
      
      // Start new range if this is a highlighted permission
      if (permission === 'w' || permission === 'n') {
        currentStart = i;
        currentPermission = permission;
      } else {
        currentStart = -1;
        currentPermission = '';
      }
    }
  }
  
  // Handle the last range if it extends to the end of the file
  if (currentStart >= 0 && currentPermission) {
    const range = new Range(
      new Position(currentStart, 0),
      new Position(lines.length - 1, lines[lines.length - 1] ? lines[lines.length - 1].length : 0)
    );
    
    if (currentPermission === 'w') {
      aiOnlyRanges.push({ range });
    } else if (currentPermission === 'n') {
      humanOnlyRanges.push({ range });
    }
  }
  
  // Apply decorations
  activeEditor.setDecorations(aiOnlyDecoration, aiOnlyRanges);
  activeEditor.setDecorations(humanOnlyDecoration, humanOnlyRanges);
  activeEditor.setDecorations(mixedDecoration, []);
}