// Focused patch to fix the two bugs in extension.ts

// The issue is how "afterBoundedRegions" is being calculated.
// Currently, the code doesn't correctly determine what permission should apply
// after a bounded region ends. It's setting this based on which unbounded region
// the bounded region STARTS in, not what should apply at the END line.

// Here's the fix for the relevant section in extension.ts:

// Around line 236-243, change:
/*
  // Create a map of what permission should apply after each bounded region
  const afterBoundedRegions = new Map();

  // Process all guard tags in order to establish the base permission state at each line
  for (let i = 0; i < guardTags.length; i++) {
    const tag = guardTags[i];
*/

// To instead directly compute the unbounded permissions first:
/*
  // First, create a map of the base permissions from unbounded regions
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
  
  // Create a map of what permission should apply after each bounded region
  // This is computed directly from the basePermissions we just established
  const afterBoundedRegions = new Map();
  
  // For each bounded region, determine what permission should apply after it ends
  const boundedRegions = guardTags.filter(tag => tag.lineCount !== undefined);
  for (const tag of boundedRegions) {
    const endLine = Math.min(tag.lineNumber + tag.lineCount + 1, lines.length);
    
    // The permission after this bounded region is whatever unbounded permission
    // would be active at the end line
    if (endLine < lines.length && basePermissions[endLine] !== null) {
      afterBoundedRegions.set(endLine, basePermissions[endLine]);
    }
  }
  
  // Now process all guard tags in order to establish the permission state at each line
  for (let i = 0; i < guardTags.length; i++) {
    const tag = guardTags[i];
*/

// This fixes both bugs:
// 1. It correctly determines what permission should apply after a bounded region ends
//    by looking at what unbounded permission would be active at that position
// 2. The existing code for Bug 2 (applying permission to empty lines) already works
//    once Bug 1 is fixed, because it uses the correct parent permission