# Core Module Sharing Strategy

## Current Status
The core guard processing logic is properly separated in `src/core/` and can be shared between the VSCode extension and other projects.

## What We Have
1. **Core Module** (`src/core/`)
   - Platform-agnostic guard tag parsing
   - Permission calculation logic
   - Tree-sitter integration
   - No VSCode dependencies

2. **JavaScript Bundle** (`dist/core-bundle.js`)
   - UMD module that can be imported in browsers or Node.js
   - Exports all core functions properly
   - Can be used directly by Python via PyExecJS or similar

## Correct Approach for Sharing with Python

### Option 1: Direct JavaScript Execution (Recommended)
Use the JavaScript bundle directly from Python:

```python
import execjs
import json

# Load the core bundle
with open('dist/core-bundle.js', 'r') as f:
    js_code = f.read()

# Create JavaScript context
ctx = execjs.compile(js_code)

# Call functions
def parse_guard_tag(line):
    result = ctx.call('TumeeCore.parseGuardTag', line)
    return json.loads(result) if result else None

def process_document(text, language_id):
    result = ctx.call('TumeeCore.processDocument', {
        'text': text,
        'languageId': language_id
    })
    return json.loads(result)
```

### Option 2: Node.js Subprocess
Create a simple Node.js CLI wrapper:

```javascript
// core-cli.js
const core = require('./dist/core-bundle.js');

const command = process.argv[2];
const args = JSON.parse(process.argv[3]);

const result = core[command](...args);
console.log(JSON.stringify(result));
```

Then from Python:
```python
import subprocess
import json

def call_core_function(command, *args):
    result = subprocess.run(
        ['node', 'core-cli.js', command, json.dumps(args)],
        capture_output=True,
        text=True
    )
    return json.loads(result.stdout)
```

### Option 3: HTTP Service
Create a simple Express server that exposes the core functions:

```javascript
const express = require('express');
const core = require('./dist/core-bundle.js');

const app = express();
app.use(express.json());

app.post('/parse-guard-tag', (req, res) => {
    const result = core.parseGuardTag(req.body.line);
    res.json(result);
});

app.post('/process-document', (req, res) => {
    const result = core.processDocument(req.body.document);
    res.json(result);
});

app.listen(3000);
```

## Why Not WASM?

1. **Javy is wrong tool** - It creates self-contained JavaScript runtimes, not libraries with exported functions
2. **AssemblyScript/Rust would be needed** - To create proper WASM modules with exports
3. **Complexity not worth it** - JavaScript execution is simpler and more maintainable
4. **Tree-sitter compatibility** - Tree-sitter already works well in JavaScript

## Next Steps

1. **Keep the core module pure** - No platform dependencies
2. **Use the JavaScript bundle** - It's already properly built
3. **Choose integration method** - Based on your Python project's needs
4. **Document the API** - Clear documentation of exported functions

## Building the Core Bundle

```bash
# This would need to be created
npm run build:core

# Creates dist/core-bundle.js with all exports
```

The JavaScript bundle is the correct artifact to share. WASM was an overengineered solution to a simple problem.