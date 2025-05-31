const TreeSitter = require('web-tree-sitter');
const { JSDOM } = require('jsdom');

// Web-tree-sitter needs some browser APIs
if (typeof global.document === 'undefined') {
  const dom = new JSDOM();
  global.document = dom.window.document;
  global.window = dom.window;
}

const Parser = TreeSitter.Parser;
const Language = TreeSitter.Language;

console.log('Parser:', Parser);
console.log('Parser methods:', Object.getOwnPropertyNames(Parser));
console.log('Parser.init:', Parser.init);

console.log('\nLanguage:', Language);
console.log('Language methods:', Object.getOwnPropertyNames(Language));
console.log('Language.load:', Language.load);

// Try to create a parser without init
try {
    const parser = new Parser();
    console.log('\nParser instance created successfully!');
    console.log('Parser instance methods:', Object.getOwnPropertyNames(parser));
} catch (error) {
    console.error('\nError creating parser:', error.message);
}