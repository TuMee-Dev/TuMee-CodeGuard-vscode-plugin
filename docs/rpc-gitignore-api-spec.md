# RPC Gitignore API Specification

## Overview
The CodeGuard CLI provides gitignore autocomplete functionality through RPC commands. All suggestions and templates are managed server-side, with no fallback data in the IDE client.

## Command: `getGitignoreSuggestions`

### Request
```json
{
  "id": "req-123",
  "command": "getGitignoreSuggestions",
  "payload": {
    "prefix": "node",
    "context": "file"
  }
}
```

### Request Parameters
- **`prefix`** (string): The text prefix to match suggestions against
- **`context`** (string): Context hint for suggestions
  - `"file"` - User is typing in .gitignore file
  - `"folder"` - User selected folder for adding to gitignore
  - `"template"` - User is creating new gitignore template

### Response (Success)
```json
{
  "id": "req-123",
  "status": "success",
  "result": {
    "suggestions": [
      {
        "label": "node_modules/",
        "detail": "Node.js dependencies",
        "documentation": "Ignores all Node.js package dependencies installed by npm/yarn",
        "insertText": "node_modules/"
      },
      {
        "label": "*.log",
        "detail": "Log files",
        "documentation": "Ignores all files with .log extension",
        "insertText": "*.log"
      }
    ]
  }
}
```

### Response (Error)
```json
{
  "id": "req-123",
  "status": "error",
  "error": "Failed to load gitignore suggestions"
}
```

### Suggestion Object Schema
```typescript
interface Suggestion {
  label: string;          // Pattern to display (e.g., "node_modules/")
  detail: string;         // Brief description (e.g., "Node.js dependencies")
  documentation: string;  // Detailed explanation
  insertText: string;     // Text to insert when selected
}
```

## Suggested Server-Side Default Patterns

When implementing this API, the server should include these common patterns:

### Development Dependencies
```json
{
  "label": "node_modules/",
  "detail": "Node.js dependencies",
  "documentation": "Ignores all Node.js package dependencies installed by npm/yarn",
  "insertText": "node_modules/"
}
```

### Build Outputs
```json
{
  "label": "dist/",
  "detail": "Distribution folder",
  "documentation": "Ignores compiled/built distribution files",
  "insertText": "dist/"
},
{
  "label": "build/",
  "detail": "Build folder", 
  "documentation": "Ignores build output directory",
  "insertText": "build/"
},
{
  "label": "out/",
  "detail": "Output folder",
  "documentation": "Ignores compilation output directory",
  "insertText": "out/"
}
```

### Log Files
```json
{
  "label": "*.log",
  "detail": "Log files",
  "documentation": "Ignores all files with .log extension",
  "insertText": "*.log"
},
{
  "label": "npm-debug.log*",
  "detail": "NPM debug logs",
  "documentation": "Ignores NPM debug log files",
  "insertText": "npm-debug.log*"
},
{
  "label": "yarn-debug.log*",
  "detail": "Yarn debug logs", 
  "documentation": "Ignores Yarn debug log files",
  "insertText": "yarn-debug.log*"
}
```

### Environment Files
```json
{
  "label": ".env",
  "detail": "Environment variables",
  "documentation": "Ignores environment configuration file containing secrets",
  "insertText": ".env"
},
{
  "label": ".env.local",
  "detail": "Local environment variables",
  "documentation": "Ignores local environment overrides",
  "insertText": ".env.local"
},
{
  "label": ".env.*.local",
  "detail": "Environment overrides",
  "documentation": "Ignores all local environment override files",
  "insertText": ".env.*.local"
}
```

### IDE Files
```json
{
  "label": ".vscode/",
  "detail": "VS Code settings",
  "documentation": "Ignores VS Code workspace settings (consider project-specific exceptions)",
  "insertText": ".vscode/"
},
{
  "label": ".idea/",
  "detail": "IntelliJ IDEA settings",
  "documentation": "Ignores IntelliJ IDEA project files",
  "insertText": ".idea/"
}
```

### OS Files
```json
{
  "label": ".DS_Store",
  "detail": "macOS system file",
  "documentation": "Ignores macOS Finder metadata files",
  "insertText": ".DS_Store"
},
{
  "label": "Thumbs.db",
  "detail": "Windows system file", 
  "documentation": "Ignores Windows thumbnail cache files",
  "insertText": "Thumbs.db"
}
```

### Temporary Files
```json
{
  "label": "*.tmp",
  "detail": "Temporary files",
  "documentation": "Ignores all temporary files",
  "insertText": "*.tmp"
},
{
  "label": "*.temp",
  "detail": "Temporary files",
  "documentation": "Ignores all temp files",
  "insertText": "*.temp"
},
{
  "label": "*.swp",
  "detail": "Vim swap files",
  "documentation": "Ignores Vim editor swap files",
  "insertText": "*.swp"
}
```

### Coverage Reports
```json
{
  "label": "coverage/",
  "detail": "Test coverage",
  "documentation": "Ignores test coverage reports",
  "insertText": "coverage/"
}
```

## Filtering Logic

The server should filter suggestions based on the `prefix` parameter:
- Case-insensitive matching
- Match against both `label` and `detail` fields
- Support partial matching (e.g., "node" matches "node_modules/")
- Return empty array if no matches found

## Future Extensions

### Contextual Suggestions
- **`"file"`**: Show general patterns
- **`"folder"`**: Prioritize directory patterns (trailing `/`)
- **`"template"`**: Include comprehensive starter templates

### Language/Framework Detection
The server could analyze the workspace and provide framework-specific suggestions:
- Detect `package.json` → include Node.js patterns
- Detect `Cargo.toml` → include Rust patterns
- Detect `.py` files → include Python patterns

### Custom Templates
Future API could support saving and retrieving custom gitignore templates.

## Implementation Notes

1. **Performance**: Server should cache common patterns for fast response
2. **Extensibility**: Pattern database should be easily configurable
3. **Context Awareness**: Future versions could analyze project structure for smarter suggestions
4. **No Client Fallbacks**: IDE client must not contain hardcoded patterns - all suggestions come from server