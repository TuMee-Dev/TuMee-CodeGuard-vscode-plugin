# RPC Gitignore Workspace Analysis API Specification

## Overview
Extends the gitignore RPC API to provide intelligent file system analysis for autocomplete suggestions based on actual workspace files and folders.

## Command: `getWorkspaceGitignoreSuggestions`

### Request
```json
{
  "id": "req-124",
  "command": "getWorkspaceGitignoreSuggestions",
  "payload": {
    "prefix": ".vscode/t",
    "workspacePath": "/Users/dev/myproject",
    "context": "file",
    "maxSuggestions": 20
  }
}
```

### Request Parameters
- **`prefix`** (string): The text prefix to match against (e.g., ".vscode/t", "src/utils/", "*.l")
- **`workspacePath`** (string): Absolute path to the workspace root
- **`context`** (string): Context hint for suggestions
  - `"file"` - User typing in .gitignore file
  - `"folder"` - User selected folder for adding to gitignore
  - `"template"` - User creating new gitignore template
- **`maxSuggestions`** (number, optional): Maximum suggestions to return (default: 20)

### Response (Success)
```json
{
  "id": "req-124",
  "status": "success",
  "result": {
    "suggestions": [
      {
        "label": "test.out",
        "detail": "File in .vscode/",
        "documentation": "Existing file: .vscode/test.out (size: 1.2KB)",
        "insertText": "test.out",
        "type": "file",
        "fullPath": ".vscode/test.out"
      },
      {
        "label": "tasks.json",
        "detail": "File in .vscode/",
        "documentation": "Existing file: .vscode/tasks.json (size: 456B)",
        "insertText": "tasks.json", 
        "type": "file",
        "fullPath": ".vscode/tasks.json"
      }
    ]
  }
}
```

### Response (Error)
```json
{
  "id": "req-124",
  "status": "error",
  "error": "Failed to analyze workspace: Permission denied"
}
```

### Suggestion Object Schema
```typescript
interface WorkspaceSuggestion {
  label: string;          // Completion text (e.g., "test.out")
  detail: string;         // Brief description (e.g., "File in .vscode/")
  documentation: string;  // Detailed info with file size, type, etc.
  insertText: string;     // Text to insert when selected
  type: "file" | "folder" | "pattern"; // Type of suggestion
  fullPath: string;       // Full relative path from workspace root
}
```

## Intelligent Matching Logic

### 1. **Path Completion**
For prefix like `.vscode/t`:
- Parse directory part (`.vscode/`) and filename part (`t`)
- Scan `.vscode/` directory for files/folders starting with `t`
- Return completions that complete the filename part

### 2. **Glob Pattern Expansion**
For prefix like `*.l`:
- Scan workspace for files with extensions starting with `l`
- Return pattern suggestions like `*.log`, `*.lock`, `*.lua` based on actual files
- Include file count in documentation: "Matches 5 files in workspace"

### 3. **Directory Traversal**
For prefix like `src/`:
- List immediate children of `src/` directory
- Prioritize folders (add trailing `/`)
- Include files if relevant to gitignore patterns

### 4. **Extension Analysis**
For prefix like `*`:
- Analyze file extensions in workspace
- Suggest common patterns: `*.tmp`, `*.log`, `*.bak`
- Include frequency data: "*.js (47 files)"

## Example Scenarios

### Scenario 1: File Completion
**User types:** `.vscode/t`
**Workspace contains:** `.vscode/test.out`, `.vscode/tasks.json`, `.vscode/settings.json`
**Response:**
```json
{
  "suggestions": [
    {
      "label": "test.out", 
      "detail": "File in .vscode/",
      "documentation": "Existing file: .vscode/test.out (size: 1.2KB, modified: 2 hours ago)",
      "insertText": "test.out",
      "type": "file",
      "fullPath": ".vscode/test.out"
    },
    {
      "label": "tasks.json",
      "detail": "File in .vscode/", 
      "documentation": "Existing file: .vscode/tasks.json (size: 456B, modified: 1 day ago)",
      "insertText": "tasks.json",
      "type": "file", 
      "fullPath": ".vscode/tasks.json"
    }
  ]
}
```

### Scenario 2: Directory Completion
**User types:** `src/`
**Workspace contains:** `src/components/`, `src/utils/`, `src/main.ts`
**Response:**
```json
{
  "suggestions": [
    {
      "label": "components/",
      "detail": "Directory (12 files)",
      "documentation": "Directory: src/components/ contains React components",
      "insertText": "components/",
      "type": "folder",
      "fullPath": "src/components/"
    },
    {
      "label": "utils/", 
      "detail": "Directory (5 files)",
      "documentation": "Directory: src/utils/ contains utility functions",
      "insertText": "utils/",
      "type": "folder",
      "fullPath": "src/utils/"
    },
    {
      "label": "main.ts",
      "detail": "TypeScript file",
      "documentation": "Existing file: src/main.ts (size: 2.1KB)",
      "insertText": "main.ts",
      "type": "file",
      "fullPath": "src/main.ts"
    }
  ]
}
```

### Scenario 3: Glob Pattern Expansion
**User types:** `*.l`
**Workspace contains:** `app.log`, `debug.log`, `package-lock.json`, `file.lua`
**Response:**
```json
{
  "suggestions": [
    {
      "label": "*.log",
      "detail": "Log files (2 matches)",
      "documentation": "Pattern matches: app.log, debug.log",
      "insertText": "*.log",
      "type": "pattern",
      "fullPath": "*.log"
    },
    {
      "label": "*.lock",
      "detail": "Lock files (1 match)", 
      "documentation": "Pattern matches: package-lock.json",
      "insertText": "*.lock",
      "type": "pattern",
      "fullPath": "*.lock"
    },
    {
      "label": "*.lua",
      "detail": "Lua files (1 match)",
      "documentation": "Pattern matches: file.lua", 
      "insertText": "*.lua",
      "type": "pattern",
      "fullPath": "*.lua"
    }
  ]
}
```

## Performance Considerations

### 1. **Caching Strategy**
- Cache directory listings with TTL (5 minutes)
- Invalidate cache on file system changes
- Use efficient file tree traversal

### 2. **Limits and Filtering**
- Respect `maxSuggestions` parameter
- Skip binary files and large files
- Prioritize recently modified files
- Filter out already ignored files

### 3. **Async Processing**
- Return cached results immediately
- Update cache in background
- Handle large workspaces gracefully

## Integration with Base API

The extension will call BOTH APIs and merge results:

1. **`getGitignoreSuggestions`** - Common patterns
2. **`getWorkspaceGitignoreSuggestions`** - Workspace-specific files

Results are merged with workspace suggestions prioritized for path completions.

## Error Handling

### Common Errors
- **Permission denied**: Workspace directory not readable
- **Path not found**: Invalid workspace path
- **Too many files**: Workspace too large to analyze efficiently

### Graceful Degradation
- If workspace analysis fails, fall back to common patterns only
- Return partial results if some directories are inaccessible
- Log errors but don't break user experience

## Security Considerations

1. **Path Validation**: Ensure workspace path is within allowed boundaries
2. **Symlink Handling**: Avoid infinite loops with circular symlinks
3. **File Size Limits**: Skip excessively large files to prevent memory issues
4. **Permission Checks**: Respect file system permissions