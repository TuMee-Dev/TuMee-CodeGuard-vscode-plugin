import { type StatusBarItem, type TextDocument, type ExtensionContext, type Disposable, window, commands, StatusBarAlignment, ThemeColor } from 'vscode';
import { isCliAvailable } from './acl';

let statusBarItem: StatusBarItem;

/**
 * Creates the status bar item that shows the CodeGuard CLI status
 * @param context The extension context
 * @returns Disposable for cleanup
 */
export function createStatusBarItem(context: ExtensionContext): Disposable[] {
  statusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 100);
  statusBarItem.command = 'tumee-vscode-plugin.showGuardInfo';

  // Add command to show guard info or CLI missing message
  const infoDisposable = commands.registerCommand('tumee-vscode-plugin.showGuardInfo', async () => {
    const cliAvailable = await isCliAvailable();

    if (cliAvailable) {
      // Show guard tags format quick reference
      void commands.executeCommand('tumee-vscode-plugin.showGuardTagsReference');
    } else {
      // Show CLI missing explanation
      void commands.executeCommand('tumee-vscode-plugin.showCliMissing');
    }
  });

  // Register guard tags reference command
  const referenceDisposable = commands.registerCommand('tumee-vscode-plugin.showGuardTagsReference', () => {
    showGuardTagsReference();
  });

  // Register CLI missing explanation command
  const cliMissingDisposable = commands.registerCommand('tumee-vscode-plugin.showCliMissing', () => {
    showCliMissingDialog();
  });

  statusBarItem.show();

  return [statusBarItem, infoDisposable, referenceDisposable, cliMissingDisposable];
}

/**
 * Updates the status bar item to show the CodeGuard CLI status
 * @param document The active document
 */
export async function updateStatusBarItem(document: TextDocument): Promise<void> {
  try {
    if (!statusBarItem) return;

    const cliAvailable = await isCliAvailable();

    if (cliAvailable) {
      statusBarItem.text = '$(shield) CodeGuard';
      statusBarItem.color = new ThemeColor('charts.green'); // Green shield when CLI available
      statusBarItem.tooltip = 'CodeGuard CLI is available. Click for guard tags reference.';
    } else {
      statusBarItem.text = '$(shield) CodeGuard';
      statusBarItem.color = new ThemeColor('charts.red'); // Red shield when CLI missing
      statusBarItem.tooltip = 'CodeGuard CLI not found. Click for installation instructions.';
    }
  } catch (error) {
    statusBarItem.text = '$(shield) CodeGuard';
    statusBarItem.color = new ThemeColor('charts.red');
    statusBarItem.tooltip = 'Error checking CodeGuard CLI availability.';
  }
}

/**
 * Shows a dialog with guard tags format quick reference
 */
function showGuardTagsReference() {
  const content = `
# CodeGuard Tag Format Reference

## Basic Syntax
\`@guard:<entity>:<permission>\`

## Entities
- **ai**: AI assistant permissions
- **human**: Human developer permissions  
- **user**: End user permissions

## Permissions
- **r**: Read-only access
- **w**: Write/modify access
- **n**: No access
- **context**: Can read for context but not modify

## Scopes
- **line**: Applies to current line only
- **block**: Applies to next code block
- **file**: Applies to entire file from this point

## Examples
\`\`\`
// @guard:ai:r - AI can read this line
// @guard:ai:w.block - AI can modify the next block
// @guard:ai:n.file - AI has no access to rest of file
// @guard:human:w,ai:r - Human write, AI read permissions
\`\`\`

## Context Guards
\`\`\`
// @guard:context:start:sensitive
// This section requires special handling
// @guard:context:end
\`\`\`
`;

  void window.showInformationMessage('CodeGuard Tags Reference', { modal: true, detail: content });
}

/**
 * Shows a dialog explaining that CodeGuard CLI is required
 */
function showCliMissingDialog() {
  const content = `
# CodeGuard CLI Required

The CodeGuard CLI tool is required for this extension to function properly.

## Installation
1. Install the CodeGuard CLI from: https://github.com/TuMee/CodeGuard
2. Ensure it's available in your system PATH
3. Restart VS Code after installation

## Verification
Run this command in your terminal to verify installation:
\`codeguard --version\`

## Alternative Configuration
You can configure a custom CLI path in settings:
\`tumee-vscode-plugin.aclCliPath\`
`;

  void window.showErrorMessage('CodeGuard CLI Not Found', { modal: true, detail: content });
}