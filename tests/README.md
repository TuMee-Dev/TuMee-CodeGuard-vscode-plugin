# Test Files for TuMee VS Code Plugin

This directory contains test files for the TuMee VS Code Plugin, organized into subdirectories:

- `line-count/`: Tests for the line counting functionality in guard tags (e.g., `@guard:ai:r.3`)
- `guard-tags/`: Tests for various guard tag formats and comment styles
- `debugging/`: Debugging scripts and proof-of-concept fixes created during development

## Running Tests

For JavaScript tests, you can run them with Node.js:

```bash
node tests/line-count/focused-fix.js
```

For Python test files, they are meant to be loaded in VS Code to visually verify the guard tag highlighting.