// Test file to demonstrate the exact bugs and fixes
// BUG 1: Numbered sections (line counts) aren't reverting to previous permissions
// BUG 2: Empty lines at the end of sections

// Demonstration of bug 1:
// We have code like:
/*
# @guard:ai:w   <-- Unbounded region starts here
Some code...
# @guard:ai:r.2 <-- Bounded region for 2 lines
Read-only line 1
Read-only line 2
Should go back to write mode here <-- Bug 1: It doesn't go back to write mode
*/

// Demonstration of bug 2:
// Empty lines are being ignored at the end of sections
/*
# @guard:ai:w.3
Line 1 (highlighted)
Line 2 (highlighted)
Line 3 (highlighted)

<-- Empty line should still be highlighted but isn't
*/