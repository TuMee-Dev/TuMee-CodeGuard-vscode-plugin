# TuMee File and Folder Customization for VS Code

A Visual Studio Code extension that customizes your files and folders based on human/AI editability attributes. Set colors, badges, or tooltips for any file or folder in your workspace based on ACL rules.

## Features

- Set custom colors, badges, and tooltips for files and folders
- Visually distinguish between human-editable and AI-editable files and folders
- Highlight code regions based on @GUARD tags with different colors
- Automatically detect ACL settings using CodeGuard CLI
- Apply colors based on detected ACL permissions
- Context menu for easy configuration

### Human and AI Colorization

This extension integrates with the CodeGuard ACL system to automatically colorize files and folders based on their human/AI access permissions:

- 🟢 **Human-Editable**: Files that are editable by humans only
- 🟣 **AI-Editable**: Files that are editable by AI only
- 🔵 **Both Human and AI Editable**: Files that can be edited by both

### Code Region Highlighting

The extension highlights code regions based on @guard tags with different colors:

- 🔴 **AI Write Access** (`@guard:ai:w`): Red background - AI can modify this code
- 🟢 **AI No Access** (`@guard:ai:n`): Green background - AI should not access this code
- 🟣 **Human Read-Only** (`@guard:human:r`): Purple background - Humans can read but not modify
- 🟠 **Human No Access** (`@guard:human:n`): Orange background - Humans should not modify this code
- 🔵 **Context Information** (`@guard:ai:context`): Cyan background - Provides context for AI/humans

Example of guard tag usage:

```js
// @guard:ai:w
// This region can be written by AI (AI can edit) - RED highlight
function aiEditableFunction() {
    // AI can modify this code
    return processData();
}

// @guard:ai:n
// This region cannot be accessed by AI at all - GREEN highlight
const secretApiKey = 'sk-12345';
const privateConfig = {
    // AI should not use or reference this code
};

// @guard:human:r
// This region is read-only for humans - PURPLE highlight
function criticalSystemFunction() {
    // Humans can read but not modify this code
    performCriticalOperation();
}

// @guard:ai:w
// Another AI-editable region - RED highlight
class DataProcessor {
    processInput(data) {
        // AI can help improve this logic
        return data.map(item => item * 2);
    }
}

// @guard:human:n
// This region cannot be accessed by humans - ORANGE highlight
const aiInternalState = {
    modelVersion: '3.0',
    internalCache: new Map()
};

// @guard:ai:context
// This region provides context information - CYAN highlight
// Documentation: This module handles user authentication
// Dependencies: crypto, jwt, bcrypt
// Last reviewed: 2024-01-15

// @guard:ai:n
// Another AI no-access region - GREEN highlight
function validateUserCredentials(username, password) {
    // Security-critical code that AI should not modify
    return bcrypt.compare(password, hashedPassword);
}

// @guard:human:r
// Another human read-only region - PURPLE highlight
const systemConstants = {
    MAX_RETRIES: 3,
    TIMEOUT_MS: 5000
};

// @guard:human:n
// Another human no-access region - ORANGE highlight
function aiOptimizedAlgorithm() {
    // Complex AI-generated code humans shouldn't modify
    return optimizedMatrix.multiply(vectorSpace);
}

// @guard:ai:context
// Another context region - CYAN highlight
// Performance notes: This function runs in O(n log n) time
// Memory usage: Approximately 2MB for typical inputs
```

#### Markdown Files

For markdown files, guard tags must be placed inside HTML comments to be recognized:

```markdown
<!-- @guard:ai:w -->
## AI-Editable Section (RED highlight)
This content can be modified by AI to improve clarity and structure.

<!-- @guard:ai:n -->
## Private Information (GREEN highlight)
API Keys: sk-prod-12345
Database passwords and other sensitive data AI should not access.

<!-- @guard:human:r -->
## Legal Notice (PURPLE highlight)
This legal text must not be modified by humans without approval.
Terms and conditions apply.

<!-- @guard:ai:w.3 -->
## Another AI Section (RED highlight)
AI can edit this paragraph and the next 2 lines.
Line 2 of 3
Line 3 of 3

<!-- @guard:human:n -->
## AI-Generated Report (ORANGE highlight)
[Complex AI-generated analysis that humans shouldn't modify]
Statistical models and predictions based on ML algorithms.

<!-- @guard:ai:context -->
## Documentation Context (CYAN highlight)
Project: TuMee VSCode Plugin
Last Updated: 2024-01-23
Dependencies: vscode, tree-sitter

<!-- @guard:ai:n -->
## Security Configuration (GREEN highlight)
Production server IPs and credentials
Critical infrastructure details

<!-- @guard:human:r -->
## Compliance Documentation (PURPLE highlight)
GDPR compliance statement
ISO 27001 certification details

<!-- @guard:human:n -->
## AI Optimization Results (ORANGE highlight)
Performance metrics from AI optimization runs
Auto-generated benchmark data

<!-- @guard:ai:context -->
## Additional Context (CYAN highlight)
Performance baseline: 100ms response time
Memory limit: 512MB
```

Guard tags that appear in regular markdown text (not in HTML comments) will not be recognized or highlighted.

The permissions follow the CodeGuard format:
- `@guard:ai:r` - AI Read-Only (can read but not modify) - no highlighting
- `@guard:ai:w` - AI Write (can read and modify) - red highlighting (#F44336)
- `@guard:ai:n` - AI None (should not access at all) - green highlighting (#4CAF50)
- `@guard:human:r` - Human Read-Only (can read but not modify) - purple highlighting (#9C27B0)
- `@guard:human:n` - Human None (should not modify) - orange highlighting (#FF9800)
- `@guard:ai:context` - Context information for AI/humans - cyan highlighting (#00BCD4)

#### Line Count Feature

You can also specify a line count to limit the scope of a guard tag:
- `@guard:ai:r.3` - Make the next 3 lines read-only for AI
- `@guard:ai:w.5` - Make the next 5 lines writable for AI
- `@guard:ai:n.1` - Make the next line inaccessible to AI

After the specified number of lines, permissions revert to the previous state. This is useful for protecting small sections of code without needing to add multiple guard tags.

By default, no assumptions are made about permissions - code is not highlighted. Guard tags explicitly set different permission levels when needed.

### Inserting Guard Tags

There are multiple ways to insert guard tags:

1. **Right-click menu**: Right-click in the editor and select one of the guard tag options
   - If you have text selected, the extension will automatically calculate the line count
   - If no text is selected, you'll be prompted for an optional line count
2. **Status bar indicator**: Click on the AI status indicator in the status bar to toggle between permissions
3. **Snippets**: Start typing `guard`, `guard-r`, `guard-w`, or `guard-n` to trigger snippets
4. **Command palette**: Use `Ctrl+Shift+P` and type "TuMee" to see available commands

When using the right-click menu, if you select multiple lines before inserting a guard tag, the extension will automatically add the appropriate line count to the tag.

The extension supports various comment styles across different programming languages:
```
// @guard:ai:r    (JavaScript/C/C++/Java)
# @guard:ai:r     (Python/Ruby/Shell)
<!-- @guard:ai:r --> (HTML/XML)
/* @guard:ai:r */ (CSS/C/Java block comment)
* @guard:ai:r     (JSDoc/PHPDoc)
-- @guard:ai:r    (SQL)
```

The extension also supports comments without spaces after the comment marker:
```
//@guard:ai:r     (No space after //)
#@guard:ai:r      (No space after #)
/*@guard:ai:r     (No space after /*)
--@guard:ai:r     (No space after --)
```

The opacity of the highlighting can be adjusted in the extension settings.

### Available Commands

- `Set Color`: Apply a custom color to files or folders
- `Set as Human-Editable`: Mark files or folders as human-editable and update ACL rules
- `Set as AI-Editable`: Mark files or folders as AI-editable and update ACL rules
- `Clear ACL Status`: Remove ACL status from files or folders
- `Set Text Badge`: Add a text badge (max 2 characters) to files or folders
- `Set Emoji Badge`: Add an emoji badge to files or folders
- `Set Tooltip`: Add a custom tooltip to files or folders
- `Clear Color/Badge/Tooltip`: Remove customizations
- `Reset Workspace`: Clear all customizations

## Requirements

- Visual Studio Code v1.92.0 or higher
- CodeGuard CLI tool installed for ACL integration

## Extension Settings

This extension contributes the following settings:

* `tumee-vscode-plugin.colorChangedFiles`: Ignore any color customizations set by the IDE when in a Git repository
* `tumee-vscode-plugin.aclCliPath`: Path to the CodeGuard CLI tool for checking ACL status
* `tumee-vscode-plugin.codeDecorationOpacity`: The opacity of the code region decorations (0.0 to 1.0)
* `tumee-vscode-plugin.items`: Array of customized files and folders with their settings

## Installation

1. Install the extension through VS Code Marketplace
2. Configure the CodeGuard CLI path in settings if needed
3. Right-click on any file or folder to access the TuMee Customization menu

## Usage

### File and Folder Customization
1. Right-click on a file or folder in the VS Code Explorer
2. Select "TuMee Customization" from the context menu
3. Choose an option like "Set as Human-Editable" or "Set as AI-Editable"
4. The file or folder will be visually decorated and ACL rules will be updated

### Code Region Highlighting
1. Add @guard tags to your code files to specify editable regions
2. Use the following format:
   ```
   // @guard:ai:r  (for AI read-only regions)
   // @guard:ai:w  (for AI writable regions)
   // @guard:ai:n  (for regions AI should not access)
   ```
3. The extension will automatically highlight these regions with the appropriate colors
4. The line containing the @guard tag is included in the highlighted region
5. Regions end at the next @guard tag or the end of the file

## Project Structure

The project is organized as follows:

- `src/`: Main source code for the extension
  - `extension.ts`: The main entry point for the extension
  - `tools/`: Tools and utilities for file customization
  - `types/`: TypeScript type definitions
  - `utils/`: Utility functions

- `tests/`: Test files organized by feature
  - `guard-tags/`: Tests for guard tag syntax and comment styles
  - `line-count/`: Tests for the line counting functionality
  - `debugging/`: Historical debugging files and proof-of-concept fixes

- `backups/`: Backup files (not used in production)

- `snippets/`: Code snippets for inserting guard tags

- `resources/`: Resources like images and icons

### Features

The extension provides several features to help you work with guard tags:

1. **Syntax highlighting**: Guard tags are highlighted to make them more visible
2. **Status bar indicator**: Shows the current AI access level at your cursor position
3. **Right-click menu**: Quickly insert guard tags with the right comment style for your language
4. **Code snippets**: Type `guard` to trigger snippets that insert guard tags
5. **Command palette integration**: Access all guard tag commands from the command palette

### Testing

Test files are organized in the `tests` directory:

- `tests/guard-tags/` - Tests for guard tag syntax and comment styles
  - `test-guard-regions.js` - Basic guard region functionality
  - `test-new-guard-format.js` - The new @guard:ai:permission format
  - `test-comment-styles.js` - @guard tags with various comment styles
  - `test-no-space-comments.js` - @guard tags without spaces after comment markers
  - `test-markdown-guards.md` - @guard tags in markdown files

- `tests/line-count/` - Tests for the line counting functionality
  - `focused-fix.js` - Main test for the bounded region fix
  - `final-test.py` - Python test file for visual verification
  - `test-line-count.js` - Basic line count functionality
  - `test-line-count-bugs.js` - Tests for specific bug fixes