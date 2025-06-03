# VS Code Context Manager Sidebar Implementation Guide

## Overview
This guide covers how to implement a single, anchored sidebar for the Context Manager in Visual Studio Code, avoiding per-window attachments.

## Best Option: Custom Activity Bar View

Create a dedicated icon in the Activity Bar (leftmost bar) that opens your own sidebar:

### Package.json Configuration
```json
{
  "name": "context-manager",
  "displayName": "Context Manager",
  "description": "Manage and visualize context usage",
  "version": "1.0.0",
  "engines": {
    "vscode": "^1.74.0"
  },
  "main": "./extension.js",
  "contributes": {
    "viewsContainers": {
      "activitybar": [
        {
          "id": "context-manager",
          "title": "Context Manager",
          "icon": "resources/context-icon.svg"
        }
      ]
    },
    "views": {
      "context-manager": [
        {
          "id": "contextMinimap",
          "name": "Context Usage",
          "type": "webview"
        }
      ]
    }
  }
}
```

### Advantages
- **Dedicated space** that users can toggle on/off
- **Single instance** across all editor windows
- **Collapsible** to just the icon when not needed
- **Persistent** across VS Code sessions
- **Follows VS Code UX** patterns

## Alternative Implementation Options

### 1. Explorer Sidebar Integration
Add your view to the existing Explorer sidebar:

```json
{
  "contributes": {
    "views": {
      "explorer": [
        {
          "id": "contextMinimap",
          "name": "Context Usage",
          "when": "resourceScheme == file",
          "visibility": "collapsed"
        }
      ]
    }
  }
}
```

**Pros:** No new icon, integrated with file explorer  
**Cons:** Competes for space with file tree

### 2. Bottom Panel Integration
Add to the panel area where Terminal/Problems/Output live:

```json
{
  "contributes": {
    "views": {
      "panel": [
        {
          "id": "contextMinimap",
          "name": "Context Usage"
        }
      ]
    }
  }
}
```

**Pros:** Good for horizontal layouts  
**Cons:** Less vertical space, competes with terminal

### 3. Secondary Side Bar (VS Code 1.64+)
Users can drag views to the secondary sidebar (right side):

```javascript
// Allow users to move your view
vscode.commands.executeCommand('workbench.action.moveViewToSecondarySideBar');
```

**Pros:** Dedicated space on right side  
**Cons:** Not all users know about secondary sidebar

## Implementation Code

### Extension Entry Point (extension.js)
```javascript
const vscode = require('vscode');

function activate(context) {
    const provider = new ContextMapProvider(context.extensionUri);
    
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'contextMinimap',
            provider
        )
    );
}

class ContextMapProvider {
    constructor(extensionUri) {
        this._extensionUri = extensionUri;
    }

    resolveWebviewView(webviewView, context, _token) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(data => {
            switch (data.type) {
                case 'deleteChunk':
                    this._deleteChunk(data.chunkId);
                    break;
                case 'updateThreshold':
                    this._updateThreshold(data.value);
                    break;
            }
        });
    }

    _getHtmlForWebview(webview) {
        // Get resource URIs
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js')
        );
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'style.css')
        );

        // Use VS Code's CSS variables for theming
        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="${styleUri}" rel="stylesheet">
                <title>Context Manager</title>
            </head>
            <body>
                <div class="context-minimap" id="contextMinimap">
                    <!-- Your minimap HTML here -->
                </div>
                <script src="${scriptUri}"></script>
            </body>
            </html>`;
    }

    _deleteChunk(chunkId) {
        // Handle chunk deletion
        // Update state and refresh view
    }

    _updateThreshold(value) {
        // Handle threshold updates
        // Store in workspace state
    }
}

module.exports = {
    activate
};
```

### CSS with VS Code Theme Variables (media/style.css)
```css
body {
    background-color: var(--vscode-sideBar-background);
    color: var(--vscode-sideBar-foreground);
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    padding: 0;
    margin: 0;
}

.context-minimap {
    height: 100%;
    display: flex;
    flex-direction: column;
}

.gauge-bar {
    background: var(--vscode-input-background);
    border: 1px solid var(--vscode-input-border);
}

.gauge-fill {
    background: var(--vscode-progressBar-background);
}

.chunk-group {
    background: var(--vscode-editor-background);
    border: 1px solid var(--vscode-panel-border);
}

.chunk-group:hover {
    background: var(--vscode-list-hoverBackground);
}

.action-button {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
}

.action-button:hover {
    background: var(--vscode-button-hoverBackground);
}

.temporal-divider {
    color: var(--vscode-descriptionForeground);
}
```

## Key Considerations

### 1. State Management
```javascript
// Store state globally (survives restarts)
context.globalState.update('contextThreshold', 40);

// Or workspace-specific
context.workspaceState.update('contextChunks', chunks);
```

### 2. Communication with Extension Host
```javascript
// From webview to extension
vscode.postMessage({
    type: 'deleteChunk',
    chunkId: 'chunk-123'
});

// From extension to webview
this._view.webview.postMessage({
    type: 'updateChunks',
    chunks: updatedChunks
});
```

### 3. Width Constraints
- Activity bar sidebars typically max at ~500px
- Design for narrow widths (200-400px)
- Make content responsive

### 4. Icon Design (resources/context-icon.svg)
```svg
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" stroke-width="2"/>
    <rect x="4" y="14" width="16" height="6" fill="currentColor" opacity="0.3"/>
    <rect x="4" y="14" width="12" height="6" fill="currentColor"/>
</svg>
```

## Architecture Diagram
```
┌─────────────────────────────────────────────┐
│  VS Code Window                             │
├────┬────────────────────┬──────────────────┤
│ 📁 │                    │                  │
│ 🔍 │                    │  Context Manager │
│ 🌿 │   Editor Area      │  ┌────────────┐ │
│ 🐛 │                    │  │ Usage: 76% │ │
│ 📊 │                    │  ├────────────┤ │
│ ^  │                    │  │ [Minimap]  │ │
│ |  │                    │  │            │ │
│Your│                    │  │ [Chunks]   │ │
│Icon│                    │  └────────────┘ │
└────┴────────────────────┴──────────────────┘
```

## Best Practices

1. **Follow VS Code UX Guidelines**
   - Use VS Code's color tokens
   - Respect user theme choices
   - Follow accessibility standards

2. **Performance**
   - Minimize webview reloads
   - Use virtual scrolling for large lists
   - Cache data when possible

3. **User Experience**
   - Remember collapsed/expanded state
   - Provide keyboard shortcuts
   - Show loading states

4. **Integration**
   - Support VS Code commands
   - Integrate with Command Palette
   - Provide settings

## Example Settings Configuration
```json
{
  "contributes": {
    "configuration": {
      "title": "Context Manager",
      "properties": {
        "contextManager.autoCleanupThreshold": {
          "type": "number",
          "default": 40,
          "description": "Percentage at which auto-cleanup triggers"
        },
        "contextManager.showMinimap": {
          "type": "boolean",
          "default": true,
          "description": "Show minimap visualization"
        }
      }
    }
  }
}
```

## Testing Checklist
- [ ] Works with all VS Code themes (dark/light/high contrast)
- [ ] Sidebar resizing works properly
- [ ] State persists across restarts
- [ ] Performance with large contexts
- [ ] Keyboard navigation support
- [ ] Screen reader compatibility

## Resources
- [VS Code Extension API](https://code.visualstudio.com/api)
- [Webview API Guide](https://code.visualstudio.com/api/extension-guides/webview)
- [VS Code UX Guidelines](https://code.visualstudio.com/api/ux-guidelines/overview)
- [Activity Bar View Sample](https://github.com/microsoft/vscode-extension-samples/tree/main/webview-view-sample)