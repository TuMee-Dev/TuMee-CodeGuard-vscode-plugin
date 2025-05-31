const Parser = require('web-tree-sitter');
const { JSDOM } = require('jsdom');

// Web-tree-sitter needs some browser APIs
if (typeof global.document === 'undefined') {
  const dom = new JSDOM();
  global.document = dom.window.document;
  global.window = dom.window;
}

console.log('Parser object:', Parser);
console.log('Parser methods:', Object.getOwnPropertyNames(Parser));
console.log('Parser prototype:', Object.getPrototypeOf(Parser));

// Check if it's a default export issue
console.log('Parser.default:', Parser.default);

if (Parser.default) {
    console.log('default methods:', Object.getOwnPropertyNames(Parser.default));
    console.log('default prototype:', Object.getPrototypeOf(Parser.default));
}

// Try different ways to access the parser
try {
    console.log('typeof Parser:', typeof Parser);
    console.log('typeof Parser.init:', typeof Parser.init);
    console.log('typeof Parser.default:', typeof Parser.default);
    if (Parser.default) {
        console.log('typeof Parser.default.init:', typeof Parser.default.init);
    }
} catch (error) {
    console.error('Error inspecting Parser:', error);
}