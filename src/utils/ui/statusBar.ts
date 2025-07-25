import { type StatusBarItem, type TextDocument, type Disposable, window, commands, StatusBarAlignment, ThemeColor } from 'vscode';
import { isCliAvailable } from '../config/acl';
import type { CLIWorker } from '../cli/cliWorker';

let statusBarItem: StatusBarItem;
let cliWorker: CLIWorker | undefined;

/**
 * Creates the status bar item that shows the CodeGuard CLI status
 * @param worker The CLI worker instance
 * @returns Disposable for cleanup
 */
export function createStatusBarItem(worker?: CLIWorker): Disposable[] {
  cliWorker = worker;
  statusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 100);
  statusBarItem.command = 'tumee-vscode-plugin.showGuardInfo';

  // Set initial state to show CLI is starting
  statusBarItem.text = '$(shield) CodeGuard';
  statusBarItem.color = new ThemeColor('charts.yellow');
  statusBarItem.tooltip = 'CodeGuard CLI starting...';

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
 * Updates the CLI worker reference for the status bar
 * @param worker The CLI worker instance (can be undefined)
 */
export function updateCliWorkerReference(worker?: CLIWorker): void {
  cliWorker = worker;
}

/**
 * Updates the status bar item to show the CodeGuard CLI status
 * @param document The active document
 */
export async function updateStatusBarItem(_document: TextDocument): Promise<void> {
  try {
    if (!statusBarItem) return;

    // Check CLI worker status first
    if (cliWorker) {
      await updateStatusBarWithWorker();
    } else {
      // Fallback to basic CLI availability check
      await updateStatusBarBasic();
    }
  } catch (error) {
    statusBarItem.text = '$(shield) CodeGuard';
    statusBarItem.color = new ThemeColor('charts.red');
    statusBarItem.tooltip = 'Error checking CodeGuard CLI status.';
  }
}

/**
 * Update status bar using CLI worker information
 */
async function updateStatusBarWithWorker(): Promise<void> {
  if (!cliWorker || !statusBarItem) return;

  if (cliWorker.isWorkerReady()) {
    // Worker is running - check version compatibility
    try {
      const versionInfo = await cliWorker.checkVersion();

      if (versionInfo.compatible) {
        // Default color: CLI available and compatible
        statusBarItem.text = '$(shield) CodeGuard';
        statusBarItem.color = undefined; // Use default status bar text color
        statusBarItem.tooltip = `CodeGuard CLI v${versionInfo.version} ready. Click for guard tags reference.`;
      } else {
        // Yellow: CLI available but older version
        statusBarItem.text = '$(shield) CodeGuard';
        statusBarItem.color = new ThemeColor('charts.yellow');
        statusBarItem.tooltip = `CodeGuard CLI v${versionInfo.version} (outdated, requires v${versionInfo.minCompatible}+). Some features may not work.`;
      }
    } catch (error) {
      // Worker exists but version check failed
      statusBarItem.text = '$(shield) CodeGuard';
      statusBarItem.color = new ThemeColor('charts.red');
      statusBarItem.tooltip = 'CodeGuard CLI worker error. Click for troubleshooting.';
    }
  } else {
    // Worker not ready (crashed or starting)
    statusBarItem.text = '$(shield) CodeGuard';
    statusBarItem.color = new ThemeColor('charts.red');
    statusBarItem.tooltip = 'CodeGuard CLI worker not available. Click for installation instructions.';
  }
}

/**
 * Update status bar with basic CLI availability check
 */
async function updateStatusBarBasic(): Promise<void> {
  if (!statusBarItem) return;

  const cliAvailable = await isCliAvailable();

  if (cliAvailable) {
    statusBarItem.text = '$(shield) CodeGuard';
    statusBarItem.color = undefined; // Use default status bar text color
    statusBarItem.tooltip = 'CodeGuard CLI detected but worker not initialized. Click for guard tags reference.';
  } else {
    statusBarItem.text = '$(shield) CodeGuard';
    statusBarItem.color = new ThemeColor('charts.red');
    statusBarItem.tooltip = 'CodeGuard CLI not found. Click for installation instructions.';
  }
}

/**
 * Update status bar when CLI worker status changes
 */
export function updateStatusBarForWorkerStatus(status: 'ready' | 'error' | 'crashed' | 'starting' | 'incompatible' | 'command-error'): void {
  if (!statusBarItem) return;

  switch (status) {
    case 'ready':
      statusBarItem.text = '$(shield) CodeGuard';
      statusBarItem.color = undefined; // Use default status bar text color
      statusBarItem.tooltip = 'CodeGuard CLI worker ready. Click for guard tags reference.';
      break;
    case 'starting':
      statusBarItem.text = '$(shield) CodeGuard';
      statusBarItem.color = new ThemeColor('charts.yellow');
      statusBarItem.tooltip = 'CodeGuard CLI worker starting...';
      break;
    case 'incompatible':
      statusBarItem.text = '$(shield) CodeGuard';
      statusBarItem.color = new ThemeColor('charts.yellow');
      statusBarItem.tooltip = 'CodeGuard CLI outdated version. Some features may not work. Click for installation instructions.';
      break;
    case 'command-error':
      statusBarItem.text = '$(shield) CodeGuard';
      statusBarItem.color = new ThemeColor('charts.yellow');
      statusBarItem.tooltip = 'CodeGuard CLI command failed. The CLI may need updating.';
      break;
    case 'error':
    case 'crashed':
      statusBarItem.text = '$(shield) CodeGuard';
      statusBarItem.color = new ThemeColor('charts.red');
      statusBarItem.tooltip = 'CodeGuard CLI worker failed. Click for troubleshooting.';
      break;
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