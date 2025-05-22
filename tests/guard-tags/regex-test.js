// Test regex pattern matching for line count in Python comments

// Sample Python comment with guard tag and line count
const pythonLine = "# @guard:ai:r.5";
const cppLine = "// @guard:ai:w.10";
const markdownLine = "<!-- @guard:ai:n.3 -->";

// Standard pattern that should work for all non-markdown files
const stdPattern = /(?:\/\/|#|--|\/\*|\*)*\s*@guard:ai:(r|w|n)(\.(\d+))?/i;

// Markdown-specific pattern
const mdPattern = /<!--.*?@guard:ai:(r|w|n)(\.(\d+))?.*?-->/i;

// Test the patterns
console.log("Python line:", pythonLine);
const pythonMatch = pythonLine.match(stdPattern);
console.log("Python match:", pythonMatch);
if (pythonMatch) {
  console.log("  Groups:", pythonMatch.length);
  console.log("  Permission:", pythonMatch[1]);
  console.log("  Group 2:", pythonMatch[2]);
  console.log("  Line count:", pythonMatch[3]);
}

console.log("\nC++ line:", cppLine);
const cppMatch = cppLine.match(stdPattern);
console.log("C++ match:", cppMatch);
if (cppMatch) {
  console.log("  Groups:", cppMatch.length);
  console.log("  Permission:", cppMatch[1]);
  console.log("  Group 2:", cppMatch[2]);
  console.log("  Line count:", cppMatch[3]);
}

console.log("\nMarkdown line:", markdownLine);
const mdMatch = markdownLine.match(mdPattern);
console.log("Markdown match:", mdMatch);
if (mdMatch) {
  console.log("  Groups:", mdMatch.length);
  console.log("  Permission:", mdMatch[1]);
  console.log("  Group 2:", mdMatch[2]);
  console.log("  Line count:", mdMatch[3]);
}

// Test alternative pattern
const altPattern = /(?:\/\/|#|--|\/\*|\*)*\s*@guard:ai:(r|w|n)\.(\d+)/i;
console.log("\nTesting alternative pattern");

const pyAltMatch = pythonLine.match(altPattern);
console.log("Python alt match:", pyAltMatch);
if (pyAltMatch) {
  console.log("  Groups:", pyAltMatch.length);
  console.log("  Permission:", pyAltMatch[1]);
  console.log("  Line count:", pyAltMatch[2]);
}