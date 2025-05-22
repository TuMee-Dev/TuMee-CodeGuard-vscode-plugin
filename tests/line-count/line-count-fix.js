// Here's the fix for line count issues in Python and other files
// This should be added to extension.ts after our helper function in acl.ts

// Import the parseGuardTag function from acl.ts
// import { parseGuardTag } from "@/utils/acl";

/**
 * Updated implementation that correctly handles line counts in Python and other files
 * This should replace or be integrated into the updateCodeDecorations function
 */
function processLineCountsInDocument(document) {
  const text = document.getText();
  const lines = text.split(/\r?\n/);
  
  // Structure to define guard regions
  const guardRegions = [];
  
  // Process line by line to find guard tags
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Parse guard tag using our helper function
    const guardInfo = parseGuardTag(line);
    
    if (guardInfo) {
      const { permission, lineCount } = guardInfo;
      
      // If lineCount is defined, create a bounded region
      if (lineCount !== undefined) {
        const endLine = Math.min(i + lineCount, lines.length);
        guardRegions.push({
          startLine: i,
          endLine: endLine,
          permission: permission
        });
        
        console.log(`Added bounded region: ${i}-${endLine}, permission=${permission}`);
      } else {
        // Find the next guard tag or end of file
        let endLine = lines.length;
        for (let j = i + 1; j < lines.length; j++) {
          if (parseGuardTag(lines[j])) {
            endLine = j;
            break;
          }
        }
        
        guardRegions.push({
          startLine: i,
          endLine: endLine,
          permission: permission
        });
        
        console.log(`Added unbounded region: ${i}-${endLine}, permission=${permission}`);
      }
    }
  }
  
  // Sort by start line to help resolve overlaps
  guardRegions.sort((a, b) => a.startLine - b.startLine);
  
  // Convert to decorations
  const aiOnlyRanges = [];
  const humanOnlyRanges = [];
  
  for (const region of guardRegions) {
    const range = new Range(
      new Position(region.startLine, 0),
      new Position(region.endLine - 1, lines[region.endLine - 1]?.length || 0)
    );
    
    if (region.permission === 'w') {
      aiOnlyRanges.push({ range });
    } else if (region.permission === 'n') {
      humanOnlyRanges.push({ range });
    }
    // No decoration for read-only (r) permission
  }
  
  // Apply decorations
  const activeEditor = window.activeTextEditor;
  if (activeEditor) {
    activeEditor.setDecorations(aiOnlyDecoration, aiOnlyRanges);
    activeEditor.setDecorations(humanOnlyDecoration, humanOnlyRanges);
    activeEditor.setDecorations(mixedDecoration, []);
  }
}