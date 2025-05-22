// Minimal version of the code that just addresses the two bugs:

function main() {
  // 1. First collect all guard tags
  // 2. Create an array of permissions for each line in the document
  
  // BUG 1: Bounded regions not reverting to previous permissions
  // APPROACH: Create an explicit mapping of parent permission for each line
  //          When a bounded region ends, look up what the parent permission is
  
  // BUG 2: Empty lines at the end of sections not being highlighted
  // APPROACH: Make sure permissions are explicitly applied to all lines
  //          If a line doesn't have a permission, it inherits from the previous line
}