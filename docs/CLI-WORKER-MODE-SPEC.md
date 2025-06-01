# CodeGuard CLI Worker Mode Specification

## Overview

This document specifies the `--worker-mode` functionality for the CodeGuard CLI tool. Worker mode provides a persistent, high-performance parser service that communicates via JSON over stdin/stdout for real-time document parsing in the VSCode extension.

## Command Line Interface

### Startup Command
```bash
codeguard --worker-mode [--min-version=1.2.0]
```

### Flags
- `--worker-mode`: Enable persistent worker mode with JSON protocol
- `--min-version`: Optional minimum version requirement for compatibility checking

### Expected Behavior
1. Start in worker mode and output version information immediately
2. Process JSON requests from stdin
3. Send JSON responses to stdout  
4. Maintain document state for delta updates
5. Exit gracefully on shutdown command or when stdin closes

## Communication Protocol

### Transport
- **Input**: JSON-over-stdin (one JSON object per message)
- **Output**: JSON-over-stdout (one JSON object per message)
- **Encoding**: UTF-8
- **Framing**: Each JSON message is terminated by double newlines (`\n\n`) like SSE format

### Startup Handshake

**On startup, immediately output version info:**
```json
{
  "type": "startup",
  "version": "1.3.5",
  "capabilities": ["delta-updates", "tree-sitter", "scope-resolution", "theme-management"],
  "ready": true
}

```

## Request/Response Protocol

### Request Format
All requests follow this structure:
```typescript
interface CLIRequest {
  id: string;                    // Unique request ID for correlation
  command: string;               // Command type
  payload?: object;              // Command-specific data
}
```

### Response Format
All responses follow this structure:
```typescript
interface CLIResponse {
  id: string;                    // Correlates to request ID
  status: "success" | "error";   // Operation result
  result?: object;               // Success data
  error?: string;                // Error message if status is "error"
  timing?: number;               // Parse time in milliseconds (optional)
}
```

## Commands

### 1. Version Check
**Request:**
```json
{
  "id": "version-1",
  "command": "version"
}
```

**Response:**
```json
{
  "id": "version-1", 
  "status": "success",
  "result": {
    "version": "1.3.5",
    "minCompatible": "1.2.0",
    "compatible": true
  }
}
```

### 2. Set Document (Initial Load)
**Request:**
```json
{
  "id": "set-doc-1",
  "command": "setDocument",
  "payload": {
    "fileName": "src/app.ts",
    "languageId": "typescript",
    "content": "// @guard:ai:r\nfunction hello() {\n  return 'world';\n}",
    "version": 1
  }
}
```

**Response:**
```json
{
  "id": "set-doc-1",
  "status": "success", 
  "result": {
    "guardTags": [
      {
        "lineNumber": 1,
        "aiPermission": "r",
        "scope": "line"
      }
    ],
    "linePermissions": [
      {
        "line": 1,
        "permissions": {"ai": "r", "human": "w"},
        "isContext": {"ai": false, "human": false}
      },
      {
        "line": 2,
        "permissions": {"ai": "r", "human": "w"}, 
        "isContext": {"ai": false, "human": false}
      },
      {
        "line": 3,
        "permissions": {"ai": "r", "human": "w"},
        "isContext": {"ai": false, "human": false}
      },
      {
        "line": 4,
        "permissions": {"ai": "r", "human": "w"},
        "isContext": {"ai": false, "human": false}
      }
    ],
    "documentVersion": 1
  },
  "timing": 15
}
```

### 3. Apply Delta (Document Changes)
**Request:**
```json
{
  "id": "delta-1",
  "command": "applyDelta",
  "payload": {
    "version": 2,
    "changes": [
      {
        "startLine": 1,
        "startChar": 0,
        "endLine": 1, 
        "endChar": 13,
        "newText": "// @guard:ai:w"
      }
    ]
  }
}
```

**Response:**
```json
{
  "id": "delta-1",
  "status": "success",
  "result": {
    "guardTags": [
      {
        "lineNumber": 1,
        "aiPermission": "w",
        "scope": "line"
      }
    ],
    "linePermissions": [
      {
        "line": 1,
        "permissions": {"ai": "w", "human": "w"},
        "isContext": {"ai": false, "human": false}
      },
      {
        "line": 2,
        "permissions": {"ai": "r", "human": "w"},
        "isContext": {"ai": false, "human": false}
      },
      {
        "line": 3,
        "permissions": {"ai": "r", "human": "w"},
        "isContext": {"ai": false, "human": false}
      },
      {
        "line": 4,
        "permissions": {"ai": "r", "human": "w"},
        "isContext": {"ai": false, "human": false}
      }
    ],
    "documentVersion": 2
  },
  "timing": 8
}
```

### 4. Ping (Health Check)
**Request:**
```json
{
  "id": "ping-1",
  "command": "ping"
}
```

**Response:**
```json
{
  "id": "ping-1",
  "status": "success",
  "result": {
    "pong": true,
    "uptime": 45230
  }
}
```

### 5. Shutdown
**Request:**
```json
{
  "id": "shutdown-1",
  "command": "shutdown"
}
```

**Response:**
```json
{
  "id": "shutdown-1",
  "status": "success",
  "result": {
    "message": "Shutting down gracefully"
  }
}
```

### 6. Get All Themes
**Request:**
```json
{
  "id": "themes-1",
  "command": "getThemes"
}
```

**Response:**
```json
{
  "id": "themes-1",
  "status": "success",
  "result": {
    "builtIn": {
      "light": {
        "name": "Light Theme",
        "colors": {
          "permissions": {
            "aiWrite": {"enabled": true, "color": "#FFA500", "transparency": 0.2},
            "aiRead": {"enabled": true, "color": "#808080", "transparency": 0.15},
            "aiNoAccess": {"enabled": true, "color": "#90EE90", "transparency": 0.2},
            "humanWrite": {"enabled": false, "color": "#0000FF", "transparency": 0.2},
            "humanRead": {"enabled": true, "color": "#D3D3D3", "transparency": 0.3},
            "humanNoAccess": {"enabled": true, "color": "#FF0000", "transparency": 0.25},
            "contextRead": {"enabled": true, "color": "#00CED1", "transparency": 0.15},
            "contextWrite": {"enabled": true, "color": "#1E90FF", "transparency": 0.15}
          },
          "borderBarEnabled": true,
          "highlightEntireLine": false,
          "mixPattern": "aiBorder"
        }
      }
    },
    "custom": {
      "mytheme": {
        "name": "My Custom Theme",
        "colors": { /* GuardColors structure */ }
      }
    }
  }
}
```

### 7. Create Theme
**Request:**
```json
{
  "id": "create-theme-1",
  "command": "createTheme",
  "payload": {
    "name": "My New Theme",
    "colors": {
      "permissions": {
        "aiWrite": {"enabled": true, "color": "#FF6B6B", "transparency": 0.3},
        "aiRead": {"enabled": true, "color": "#4ECDC4", "transparency": 0.2},
        "aiNoAccess": {"enabled": true, "color": "#45B7D1", "transparency": 0.25},
        "humanWrite": {"enabled": true, "color": "#96CEB4", "transparency": 0.2},
        "humanRead": {"enabled": true, "color": "#FCEA2B", "transparency": 0.15},
        "humanNoAccess": {"enabled": true, "color": "#FF9F43", "transparency": 0.3},
        "contextRead": {"enabled": true, "color": "#A55EEA", "transparency": 0.2},
        "contextWrite": {"enabled": true, "color": "#26C281", "transparency": 0.2}
      },
      "borderBarEnabled": true,
      "highlightEntireLine": false,
      "mixPattern": "average"
    }
  }
}
```

**Response:**
```json
{
  "id": "create-theme-1",
  "status": "success",
  "result": {
    "themeId": "mynewtheme",
    "message": "Theme 'My New Theme' created successfully"
  }
}
```

### 8. Update Theme
**Request:**
```json
{
  "id": "update-theme-1",
  "command": "updateTheme",
  "payload": {
    "themeId": "mynewtheme",
    "name": "My Updated Theme",
    "colors": {
      /* complete GuardColors structure */
    }
  }
}
```

**Response:**
```json
{
  "id": "update-theme-1",
  "status": "success",
  "result": {
    "message": "Theme 'My Updated Theme' updated successfully"
  }
}
```

### 9. Delete Theme
**Request:**
```json
{
  "id": "delete-theme-1",
  "command": "deleteTheme",
  "payload": {
    "themeId": "mynewtheme"
  }
}
```

**Response:**
```json
{
  "id": "delete-theme-1",
  "status": "success",
  "result": {
    "message": "Theme 'My New Theme' deleted successfully"
  }
}
```

### 10. Export Theme
**Request:**
```json
{
  "id": "export-theme-1",
  "command": "exportTheme",
  "payload": {
    "themeId": "mytheme"
  }
}
```

**Response:**
```json
{
  "id": "export-theme-1",
  "status": "success",
  "result": {
    "name": "My Custom Theme",
    "exportData": {
      "name": "My Custom Theme",
      "colors": { /* GuardColors structure */ },
      "exportedAt": "2025-01-26T10:30:00Z",
      "version": "1.3.5"
    }
  }
}
```

### 11. Import Theme
**Request:**
```json
{
  "id": "import-theme-1",
  "command": "importTheme",
  "payload": {
    "exportData": {
      "name": "Imported Theme",
      "colors": { /* GuardColors structure */ },
      "exportedAt": "2025-01-26T10:30:00Z",
      "version": "1.3.5"
    }
  }
}
```

**Response:**
```json
{
  "id": "import-theme-1",
  "status": "success",
  "result": {
    "themeId": "importedtheme",
    "message": "Theme 'Imported Theme' imported successfully"
  }
}
```

### 12. Get Current Theme
**Request:**
```json
{
  "id": "current-theme-1",
  "command": "getCurrentTheme"
}
```

**Response:**
```json
{
  "id": "current-theme-1",
  "status": "success",
  "result": {
    "selectedTheme": "mytheme",
    "isBuiltIn": false,
    "colors": { /* complete GuardColors structure */ }
  }
}
```

### 13. Set Current Theme
**Request:**
```json
{
  "id": "set-theme-1",
  "command": "setCurrentTheme",
  "payload": {
    "themeId": "dark"
  }
}
```

**Response:**
```json
{
  "id": "set-theme-1",
  "status": "success",
  "result": {
    "message": "Theme 'Dark Theme' selected successfully",
    "colors": { /* complete GuardColors structure for selected theme */ }
  }
}
```

## Data Structures

### GuardTag
```typescript
interface GuardTag {
  lineNumber: number;
  identifier?: string;
  scope?: string;              // "line", "block", "file"
  lineCount?: number;
  addScopes?: string[];
  removeScopes?: string[];
  scopeStart?: number;
  scopeEnd?: number;
  aiPermission?: "r" | "w" | "n" | "contextWrite";
  humanPermission?: "r" | "w" | "n" | "contextWrite";
  aiIsContext?: boolean;
  humanIsContext?: boolean;
}
```

### LinePermission
```typescript
interface LinePermission {
  line: number;
  permissions: {
    [target: string]: string;   // e.g., {"ai": "w", "human": "r"}
  };
  isContext: {
    [target: string]: boolean;  // e.g., {"ai": true, "human": false}
  };
  identifier?: string;
  isTrailingWhitespace?: boolean;
}
```

### TextChange (for delta updates)
```typescript
interface TextChange {
  startLine: number;           // 0-based line number
  startChar: number;           // 0-based character offset
  endLine: number;             // 0-based line number
  endChar: number;             // 0-based character offset  
  newText: string;             // Replacement text
}
```

### GuardColors
```typescript
interface GuardColors {
  permissions: {
    aiWrite: PermissionColorConfig;
    aiRead: PermissionColorConfig;
    aiNoAccess: PermissionColorConfig;
    humanWrite: PermissionColorConfig;
    humanRead: PermissionColorConfig;
    humanNoAccess: PermissionColorConfig;
    contextRead: PermissionColorConfig;
    contextWrite: PermissionColorConfig;
  };
  borderBarEnabled: boolean;
  highlightEntireLine?: boolean;
  mixPattern?: "aiBorder" | "aiPriority" | "average" | "humanBorder" | "humanPriority";
  combinations?: {
    [key: string]: string;  // e.g., "aiRead_humanWrite": "#FF0000"
  };
}
```

### PermissionColorConfig
```typescript
interface PermissionColorConfig {
  enabled: boolean;
  color: string;                 // Hex color code
  transparency: number;          // 0.0 to 1.0
  borderOpacity?: number;        // 0.0 to 1.0
  minimapColor?: string;         // Optional custom minimap color
  highlightEntireLine?: boolean; // Override global setting per permission
}
```

### ThemeExportData
```typescript
interface ThemeExportData {
  name: string;
  colors: GuardColors;
  exportedAt: string;           // ISO 8601 timestamp
  version: string;              // CLI version that exported it
}
```

## Error Handling

### Error Response Format
```json
{
  "id": "request-id",
  "status": "error",
  "error": "Descriptive error message",
  "code": "ERROR_CODE"
}
```

### Error Codes
- `INVALID_JSON`: Malformed JSON in request
- `UNKNOWN_COMMAND`: Unrecognized command
- `INVALID_DELTA`: Delta cannot be applied to current document state
- `NO_DOCUMENT`: Delta command sent before setDocument
- `PARSE_ERROR`: Guard tag parsing failed
- `VERSION_MISMATCH`: Incompatible version
- `THEME_NOT_FOUND`: Specified theme does not exist
- `THEME_ALREADY_EXISTS`: Theme with that name already exists
- `INVALID_THEME_DATA`: Theme data structure is invalid
- `BUILTIN_THEME_READONLY`: Cannot modify or delete built-in themes
- `INVALID_EXPORT_DATA`: Import data is malformed or incompatible

## Performance Requirements

1. **Startup Time**: < 2 seconds to ready state
2. **Delta Processing**: < 50ms for typical edits (1-10 lines changed)
3. **Full Document**: < 200ms for files up to 10,000 lines
4. **Memory**: Maintain only current document state, no excessive caching

## State Management

1. **Single Document**: Worker maintains state for one document at a time
2. **Version Tracking**: Each document state has a version number for delta synchronization
3. **Document Switching**: New `setDocument` command replaces current document state
4. **Clean State**: No persistent state between documents

## Compatibility

- **Minimum CLI Version**: 1.2.0
- **Protocol Version**: 1.0
- **Language Support**: All languages supported by current CodeGuard parser
- **Guard Tag Formats**: All current formats (@guard:ai:r, context guards, etc.)

## Example Session

```bash
# CLI startup
$ codeguard --worker-mode
{"type":"startup","version":"1.3.5","capabilities":["delta-updates","tree-sitter"],"ready":true}

# VSCode sends document
{"id":"1","command":"setDocument","payload":{"fileName":"app.js","content":"// @guard:ai:r\nconsole.log('hello');","version":1}}
{"id":"1","status":"success","result":{"guardTags":[{"lineNumber":1,"aiPermission":"r","scope":"line"}],"linePermissions":[{"line":1,"permissions":{"ai":"r","human":"w"},"isContext":{"ai":false,"human":false}},{"line":2,"permissions":{"ai":"r","human":"w"},"isContext":{"ai":false,"human":false}}],"documentVersion":1},"timing":12}

# User types - VSCode sends delta
{"id":"2","command":"applyDelta","payload":{"version":2,"changes":[{"startLine":1,"startChar":19,"endLine":1,"endChar":19,"newText":" world"}]}}
{"id":"2","status":"success","result":{"guardTags":[{"lineNumber":1,"aiPermission":"r","scope":"line"}],"linePermissions":[{"line":1,"permissions":{"ai":"r","human":"w"},"isContext":{"ai":false,"human":false}},{"line":2,"permissions":{"ai":"r","human":"w"},"isContext":{"ai":false,"human":false}}],"documentVersion":2},"timing":5}

# Get available themes
{"id":"3","command":"getThemes"}
{"id":"3","status":"success","result":{"builtIn":{"light":{"name":"Light Theme","colors":{"permissions":{"aiWrite":{"enabled":true,"color":"#FFA500","transparency":0.2}}}},"dark":{"name":"Dark Theme","colors":{"permissions":{"aiWrite":{"enabled":true,"color":"#FF6B6B","transparency":0.3}}}}},"custom":{}}}

# Set current theme to dark
{"id":"4","command":"setCurrentTheme","payload":{"themeId":"dark"}}
{"id":"4","status":"success","result":{"message":"Theme 'Dark Theme' selected successfully","colors":{"permissions":{"aiWrite":{"enabled":true,"color":"#FF6B6B","transparency":0.3}}}}}

# Shutdown
{"id":"5","command":"shutdown"}
{"id":"5","status":"success","result":{"message":"Shutting down gracefully"}}
```

## Implementation Notes

1. **Use existing parser logic** - Reuse current CodeGuard parsing core, just expose via worker mode
2. **Language detection** - Use VSCode's `languageId` field from document (more accurate than file extensions)
3. **Tree-sitter integration** - Maintain current tree-sitter capabilities for scope resolution
4. **Configuration** - Use default configuration; worker mode doesn't need config file support
5. **Logging** - Minimal logging; errors should be returned via protocol, not logged to files
6. **Theme Storage** - Built-in themes from `resources/themes.json`, custom themes in CLI config directory (`~/.config/codeguard/themes.json`)
7. **Theme Migration** - Migrate existing VSCode custom themes during first CLI startup
8. **Theme Validation** - Validate all theme data: colors (hex format), transparency (0.0-1.0), required permissions