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
  "capabilities": ["delta-updates", "tree-sitter", "scope-resolution"],
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

# Shutdown
{"id":"3","command":"shutdown"}
{"id":"3","status":"success","result":{"message":"Shutting down gracefully"}}
```

## Implementation Notes

1. **Use existing parser logic** - Reuse current CodeGuard parsing core, just expose via worker mode
2. **Language detection** - Use fileName extension for language detection
3. **Tree-sitter integration** - Maintain current tree-sitter capabilities for scope resolution
4. **Configuration** - Use default configuration; worker mode doesn't need config file support
5. **Logging** - Minimal logging; errors should be returned via protocol, not logged to files