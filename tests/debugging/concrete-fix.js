// Simple, direct fix for the line count issue in extension.ts

// Find the code where we set the line count and savedStateLine:

// BEFORE:
/*
// Set when to restore this state (after line count lines)
currentState.lineCount = lineCount;
currentState.savedStateLine = i + lineCount;
*/

// AFTER:
/*
// Set when to restore this state (after line count lines)
// Important: We add 1 to make it restore AFTER the count ends, not at the last line
currentState.lineCount = lineCount;
currentState.savedStateLine = i + lineCount + 1;
*/

// This ensures that for a line count of 3, we highlight 3 lines (not including the guard line)
// and then restore the state after those 3 lines are done.

// The problem is that we were restoring the state at the LAST line of the count
// instead of the line AFTER the count.