// Final fixed implementation of updateCodeDecorations
// This fixes both bugs:
// 1. Bounded regions not reverting to previous permissions
// 2. Empty lines at the end of sections not getting proper highlighting

function updateCodeDecorations(document) {
  if (!document) return;
  
  const activeEditor = window.activeTextEditor;
  if (!activeEditor) return;

  const text = document.getText();
  const lines = text.split(/\r?\n/);
  const isMarkdown = document.languageId === 'markdown';
  const isPython = document.languageId === 'python';
  
  // Define language-specific patterns
  const MARKDOWN_PATTERN = /<!--.*?@guard:ai:(r|w|n)(\.(\d+))?.*?-->/i;
  const PYTHON_PATTERN = /#\s*@guard:ai:(r|w|n)(\.(\d+))?/i;
  const GENERAL_PATTERN = /(?:\/\/|#|--|\/\*|\*)*\s*@guard:ai:(r|w|n)(\.(\d+))?/i;
  
  // Check if the document has any guard tags
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
  
  // Find all guard tags and store their positions and permissions
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
  
  // Sort guard tags by line number
  guardTags.sort((a, b) => a.lineNumber - b.lineNumber);
  
  if (guardTags.length === 0) return;
  
  // STEP 1: First create a map of the base permissions from unbounded regions
  const basePermissions = new Array(lines.length).fill(null);
  
  // Get all unbounded tags
  const unboundedTags = guardTags.filter(tag => tag.lineCount === undefined);
  
  // Apply each unbounded region's permission
  for (let i = 0; i < unboundedTags.length; i++) {
    const tag = unboundedTags[i];
    const startLine = tag.lineNumber;
    
    // The end is either the next unbounded tag or the end of file
    let endLine;
    if (i < unboundedTags.length - 1) {
      endLine = unboundedTags[i + 1].lineNumber;
    } else {
      endLine = lines.length;
    }
    
    // Apply this unbounded permission to all lines in range
    for (let j = startLine; j < endLine; j++) {
      basePermissions[j] = tag.permission;
    }
  }
  
  // Apply base permissions to establish the initial state
  for (let i = 0; i < lines.length; i++) {
    if (basePermissions[i] !== null) {
      linePermissions[i] = basePermissions[i];
    }
  }
  
  // STEP 2: Process all bounded regions (with line counts)
  const boundedTags = guardTags.filter(tag => tag.lineCount !== undefined);
  
  for (const tag of boundedTags) {
    const startLine = tag.lineNumber;
    // +1 ensures we count the guard tag line itself in the line count
    const endLine = Math.min(startLine + tag.lineCount + 1, lines.length);
    
    // Apply permission to all lines within the bounded region
    for (let i = startLine; i < endLine; i++) {
      linePermissions[i] = tag.permission;
    }
    
    // BUGFIX 1: After bounded region ends, find the correct permission to apply
    if (endLine < lines.length) {
      // Look up what the base permission is at this ending line
      const parentPermission = basePermissions[endLine];
      
      if (parentPermission) {
        // Apply the correct parent permission at the end line
        linePermissions[endLine] = parentPermission;
        
        // BUGFIX 2: Also apply to all following lines until the next guard tag
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