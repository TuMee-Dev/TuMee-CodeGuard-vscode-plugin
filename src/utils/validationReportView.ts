// Validation report visualization for guard section mismatches
// Shows detailed comparison between plugin and CLI parsing results

import type {
  WebviewPanel,
  ExtensionContext,
  TextEditorDecorationType,
  DecorationOptions,
  OutputChannel } from 'vscode';
import {
  window,
  ViewColumn,
  Uri,
  Range,
  Position,
  OverviewRulerLane,
  ThemeColor,
  workspace,
  Selection,
  TextEditorRevealType,
  env
} from 'vscode';
import { ValidationStatus, DiscrepancyType } from '@/types/validationTypes';
import type {
  ValidationResult,
  Discrepancy,
  ValidationStatistics
} from '@/types/validationTypes';

let validationPanel: WebviewPanel | undefined;
let errorDecorationType: TextEditorDecorationType;
let warningDecorationType: TextEditorDecorationType;
let debugChannel: OutputChannel | undefined;

// Initialize decoration types for highlighting mismatches
function initializeDecorationTypes(): void {
  if (!errorDecorationType) {
    errorDecorationType = window.createTextEditorDecorationType({
      backgroundColor: new ThemeColor('diffEditor.removedTextBackground'),
      borderColor: new ThemeColor('editorError.foreground'),
      borderStyle: 'solid',
      borderWidth: '1px',
      overviewRulerColor: new ThemeColor('editorError.foreground'),
      overviewRulerLane: OverviewRulerLane.Full,
      after: {
        contentText: ' ❌',
        color: new ThemeColor('editorError.foreground')
      }
    });
  }

  if (!warningDecorationType) {
    warningDecorationType = window.createTextEditorDecorationType({
      backgroundColor: new ThemeColor('diffEditor.insertedTextBackground'),
      borderColor: new ThemeColor('editorWarning.foreground'),
      borderStyle: 'dashed',
      borderWidth: '1px',
      overviewRulerColor: new ThemeColor('editorWarning.foreground'),
      overviewRulerLane: OverviewRulerLane.Full,
      after: {
        contentText: ' ⚠️',
        color: new ThemeColor('editorWarning.foreground')
      }
    });
  }
}

export function showValidationReport(
  context: ExtensionContext,
  result: ValidationResult
): void {
  // Create debug channel if needed
  if (!debugChannel) {
    debugChannel = window.createOutputChannel('TuMee Debug');
  }

  initializeDecorationTypes();

  // Validate result object
  if (!result) {
    void window.showErrorMessage('Validation result is undefined');
    return;
  }

  // Ensure required fields exist with defaults
  result.file_path = result.file_path || 'Unknown file';
  result.status = result.status || ValidationStatus.ErrorInternal;
  result.timestamp = result.timestamp || new Date();
  result.discrepancies = result.discrepancies || [];
  result.statistics = result.statistics || {
    total_lines: 0,
    plugin_guard_regions: 0,
    tool_guard_regions: 0,
    matching_regions: 0,
    max_overlapping_guards: 0,
    lines_with_multiple_guards: 0,
    discrepancy_count: 0,
    affected_lines: 0
  };

  // Create or reveal the webview panel
  if (validationPanel) {
    // Panel exists, just reveal and update
    validationPanel.reveal(ViewColumn.Two, false);
    validationPanel.webview.html = getWebviewContent(result);
  } else {
    // Create new panel
    validationPanel = window.createWebviewPanel(
      'codeGuardValidation',
      'CodeGuard Validation Report',
      ViewColumn.Two,  // Create in column 2 to avoid conflicts
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    // Set up dispose handler
    validationPanel.onDidDispose(() => {
      validationPanel = undefined;
    });

    // Set content FIRST
    const html = getWebviewContent(result);

    // WORKAROUND: Delay setting HTML content to ensure panel is ready
    // This fixes the first-time display issue
    setTimeout(() => {
      if (validationPanel) {
        validationPanel.webview.html = html;
        validationPanel.reveal(ViewColumn.Two, true);  // true = preserve focus
      }
    }, 100);  // 100ms delay is usually sufficient
  }

  // Handle messages from the webview
  validationPanel.webview.onDidReceiveMessage(
    async (message: { command: string; file?: string; line?: number; discrepancy?: Discrepancy }) => {
      switch (message.command) {
        case 'navigateToLine':
          if (message.file && message.line) {
            await navigateToLine(message.file, message.line);
          }
          break;
        case 'showLayerVisualization':
          if (message.line && message.discrepancy) {
            showLayerVisualization(message.line, message.discrepancy);
          }
          break;
        case 'saveReport':
          await saveValidationReport(result);
          break;
        case 'copyToClipboard':
          await copyReportToClipboard(result);
          break;
      }
    },
    undefined,
    context.subscriptions
  );

  // Highlight mismatched regions in the editor
  highlightMismatchedRegions(result.discrepancies, result.file_path);
}

function getWebviewContent(result: ValidationResult): string {
  const statusClass = result.status === ValidationStatus.Match ? 'success' : 'error';
  const statusIcon = result.status === ValidationStatus.Match ? '✅' : '❌';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CodeGuard Validation Report</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      padding: 20px;
      line-height: 1.6;
    }
    
    h1, h2, h3 {
      font-weight: 600;
      margin-top: 20px;
      margin-bottom: 10px;
    }
    
    .header {
      border-bottom: 2px solid var(--vscode-panel-border);
      padding-bottom: 20px;
      margin-bottom: 20px;
    }
    
    .status {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 4px 12px;
      border-radius: 4px;
      font-weight: 500;
    }
    
    .status.success {
      background-color: var(--vscode-testing-iconPassed);
      color: var(--vscode-editor-background);
    }
    
    .status.error {
      background-color: var(--vscode-testing-iconFailed);
      color: var(--vscode-editor-background);
    }
    
    .statistics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin: 20px 0;
    }
    
    .stat-card {
      background-color: var(--vscode-editor-inactiveSelectionBackground);
      padding: 16px;
      border-radius: 4px;
      border: 1px solid var(--vscode-panel-border);
    }
    
    .stat-value {
      font-size: 24px;
      font-weight: 600;
      color: var(--vscode-textLink-foreground);
    }
    
    .stat-label {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      text-transform: uppercase;
      margin-top: 4px;
    }
    
    .discrepancy {
      background-color: var(--vscode-editor-inactiveSelectionBackground);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      padding: 16px;
      margin: 12px 0;
    }
    
    .discrepancy.error {
      border-left: 4px solid var(--vscode-editorError-foreground);
    }
    
    .discrepancy.warning {
      border-left: 4px solid var(--vscode-editorWarning-foreground);
    }
    
    .discrepancy-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    
    .discrepancy-type {
      font-weight: 600;
      text-transform: capitalize;
    }
    
    .line-link {
      color: var(--vscode-textLink-foreground);
      cursor: pointer;
      text-decoration: none;
      font-family: var(--vscode-editor-font-family);
    }
    
    .line-link:hover {
      text-decoration: underline;
    }
    
    .guard-comparison {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-top: 12px;
    }
    
    .guard-list {
      background-color: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      padding: 12px;
    }
    
    .guard-list h4 {
      margin: 0 0 8px 0;
      font-size: 12px;
      text-transform: uppercase;
      color: var(--vscode-descriptionForeground);
    }
    
    .guard-item {
      font-family: var(--vscode-editor-font-family);
      font-size: 12px;
      padding: 4px 0;
      color: var(--vscode-textPreformat-foreground);
    }
    
    .actions {
      display: flex;
      gap: 8px;
      margin-top: 20px;
    }
    
    button {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 6px 14px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
    }
    
    button:hover {
      background-color: var(--vscode-button-hoverBackground);
    }
    
    .layer-viz-button {
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    
    .layer-viz-button:hover {
      background-color: var(--vscode-button-secondaryHoverBackground);
    }
    
    code {
      font-family: var(--vscode-editor-font-family);
      background-color: var(--vscode-textCodeBlock-background);
      padding: 2px 4px;
      border-radius: 3px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>CodeGuard Validation Report</h1>
    <p><strong>File:</strong> <code>${result.file_path}</code></p>
    <p><strong>Status:</strong> <span class="status ${statusClass}">${statusIcon} ${result.status}</span></p>
    <p><strong>Timestamp:</strong> ${new Date(result.timestamp).toLocaleString()}</p>
  </div>
  
  ${result.statistics ? getStatisticsHtml(result.statistics) : ''}
  
  ${(result.discrepancies && result.discrepancies.length > 0) ? getDiscrepanciesHtml(result) : getSuccessHtml()}
  
  <div class="actions">
    <button onclick="saveReport()">Save Report</button>
    <button onclick="copyToClipboard()">Copy to Clipboard</button>
  </div>
  
  <script>
    const vscode = acquireVsCodeApi();
    
    function navigateToLine(line) {
      vscode.postMessage({
        command: 'navigateToLine',
        file: '${result.file_path}',
        line: line
      });
    }
    
    function showLayerVisualization(line, discrepancy) {
      vscode.postMessage({
        command: 'showLayerVisualization',
        line: line,
        discrepancy: discrepancy
      });
    }
    
    function saveReport() {
      vscode.postMessage({ command: 'saveReport' });
    }
    
    function copyToClipboard() {
      vscode.postMessage({ command: 'copyToClipboard' });
    }
  </script>
</body>
</html>`;
}

function getStatisticsHtml(stats: ValidationStatistics): string {
  return `
  <h2>Statistics</h2>
  <div class="statistics">
    <div class="stat-card">
      <div class="stat-value">${stats.total_lines}</div>
      <div class="stat-label">Total Lines</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${stats.plugin_guard_regions}</div>
      <div class="stat-label">Plugin Guards</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${stats.tool_guard_regions}</div>
      <div class="stat-label">Tool Guards</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${stats.matching_regions}</div>
      <div class="stat-label">Matching Regions</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${stats.max_overlapping_guards}</div>
      <div class="stat-label">Max Overlapping</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${stats.discrepancy_count}</div>
      <div class="stat-label">Discrepancies</div>
    </div>
  </div>`;
}

function getDiscrepanciesHtml(result: ValidationResult): string {
  if (!result.discrepancies || !Array.isArray(result.discrepancies)) {
    return '<h2>No Discrepancies Found</h2>';
  }

  const errors = result.discrepancies.filter(d => d.severity === 'ERROR');
  const warnings = result.discrepancies.filter(d => d.severity === 'WARNING');

  let html = '<h2>Discrepancies</h2>';

  if (errors.length > 0) {
    html += '<h3>❌ Errors</h3>';
    html += errors.map(d => getDiscrepancyHtml(d)).join('');
  }

  if (warnings.length > 0) {
    html += '<h3>⚠️ Warnings</h3>';
    html += warnings.map(d => getDiscrepancyHtml(d)).join('');
  }

  return html;
}

function getDiscrepancyHtml(discrepancy: Discrepancy): string {
  const severityClass = discrepancy.severity.toLowerCase();
  const icon = discrepancy.severity === 'ERROR' ? '❌' : '⚠️';

  let guardComparison = '';
  if (discrepancy.plugin_guards && discrepancy.tool_guards) {
    guardComparison = `
    <div class="guard-comparison">
      <div class="guard-list">
        <h4>Plugin Guards</h4>
        ${discrepancy.plugin_guards.map(g =>
    `<div class="guard-item">${g.guard}</div>`
  ).join('')}
      </div>
      <div class="guard-list">
        <h4>Tool Guards</h4>
        ${discrepancy.tool_guards.map(g =>
    `<div class="guard-item">${g.guard}</div>`
  ).join('')}
      </div>
    </div>`;
  }

  const lineLink = discrepancy.line
    ? `<a class="line-link" onclick="navigateToLine(${discrepancy.line})">Line ${discrepancy.line}</a>`
    : '';

  const layerButton = discrepancy.type === DiscrepancyType.LayerMismatch && discrepancy.line
    ? `<button class="layer-viz-button" onclick='showLayerVisualization(${discrepancy.line}, ${JSON.stringify(discrepancy)})'>Show Layers</button>`
    : '';

  return `
  <div class="discrepancy ${severityClass}">
    <div class="discrepancy-header">
      <div>
        ${icon} <span class="discrepancy-type">${discrepancy.type.replace(/_/g, ' ')}</span>
        ${lineLink}
      </div>
      ${layerButton}
    </div>
    <p>${discrepancy.message}</p>
    ${guardComparison}
  </div>`;
}

function getSuccessHtml(): string {
  return `
  <div style="text-align: center; padding: 40px;">
    <h2 style="color: var(--vscode-testing-iconPassed);">✅ Perfect Match!</h2>
    <p>The plugin and CodeGuard tool parse all guard regions identically.</p>
  </div>`;
}

async function navigateToLine(filePath: string, line: number): Promise<void> {
  const document = await workspace.openTextDocument(Uri.file(filePath));
  const editor = await window.showTextDocument(document);
  const position = new Position(line - 1, 0);
  const range = new Range(position, position);

  editor.selection = new Selection(position, position);
  editor.revealRange(range, TextEditorRevealType.InCenter);
}

function showLayerVisualization(line: number, discrepancy: Discrepancy): void {
  // Create a hover-like display showing the guard layers
  const quickPick = window.createQuickPick();
  quickPick.title = `Guard Layers at Line ${line}`;
  quickPick.placeholder = 'Comparison of guard layers between plugin and tool';

  const items = [];

  if (discrepancy.plugin_guards) {
    items.push({
      label: '$(layers) Plugin View',
      description: 'Guards detected by the plugin',
      detail: discrepancy.plugin_guards.map(g => g.guard).join(' + ')
    });
  }

  if (discrepancy.tool_guards) {
    items.push({
      label: '$(layers) Tool View',
      description: 'Guards detected by CodeGuard CLI',
      detail: discrepancy.tool_guards.map(g => g.guard).join(' + ')
    });
  }

  quickPick.items = items;
  quickPick.show();
}

function highlightMismatchedRegions(discrepancies: Discrepancy[], filePath?: string): void {
  if (!discrepancies || !Array.isArray(discrepancies)) return;

  // Find the editor for the validated file
  let targetEditor = window.activeTextEditor;

  if (filePath) {
    // Search all visible text editors for the one showing our file
    for (const editor of window.visibleTextEditors) {
      if (editor.document.fileName === filePath) {
        targetEditor = editor;
        break;
      }
    }
  }

  if (!targetEditor || (filePath && targetEditor.document.fileName !== filePath)) {
    // No editor found for the file
    return;
  }

  const errorDecorations: DecorationOptions[] = [];
  const warningDecorations: DecorationOptions[] = [];

  for (const discrepancy of discrepancies) {
    if (discrepancy.line) {
      const range = new Range(
        new Position(discrepancy.line - 1, 0),
        new Position(discrepancy.line - 1, Number.MAX_SAFE_INTEGER)
      );

      const decoration: DecorationOptions = {
        range,
        hoverMessage: `${discrepancy.type}: ${discrepancy.message}`
      };

      if (discrepancy.severity === 'ERROR') {
        errorDecorations.push(decoration);
      } else {
        warningDecorations.push(decoration);
      }
    }
  }

  targetEditor.setDecorations(errorDecorationType, errorDecorations);
  targetEditor.setDecorations(warningDecorationType, warningDecorations);
}

async function saveValidationReport(result: ValidationResult): Promise<void> {
  const uri = await window.showSaveDialog({
    defaultUri: Uri.file('validation-report.json'),
    filters: {
      'JSON': ['json'],
      'All Files': ['*']
    }
  });

  if (uri) {
    const content = JSON.stringify(result, null, 2);
    await workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
    await window.showInformationMessage(`Validation report saved to ${uri.fsPath}`);
  }
}

async function copyReportToClipboard(result: ValidationResult): Promise<void> {
  const report = formatReportAsText(result);
  await env.clipboard.writeText(report);
  await window.showInformationMessage('Validation report copied to clipboard');
}

function formatReportAsText(result: ValidationResult): string {
  let report = `CodeGuard Validation Report
${'='.repeat(80)}
File: ${result.file_path}
Status: ${result.status}
Timestamp: ${new Date(result.timestamp).toLocaleString()}

Statistics:
-----------
Total Lines: ${result.statistics.total_lines}
Plugin Guard Regions: ${result.statistics.plugin_guard_regions}
Tool Guard Regions: ${result.statistics.tool_guard_regions}
Matching Regions: ${result.statistics.matching_regions}
Max Overlapping Guards: ${result.statistics.max_overlapping_guards}
Discrepancy Count: ${result.statistics.discrepancy_count}
`;

  if (result.discrepancies.length > 0) {
    report += '\nDiscrepancies:\n';
    report += `${'-'.repeat(80)  }\n`;

    for (const d of result.discrepancies) {
      const icon = d.severity === 'ERROR' ? '❌' : '⚠️';
      const lineInfo = d.line ? ` - Line ${d.line}` : '';
      report += `\n${icon} ${d.severity}${lineInfo}: ${d.type}\n`;
      report += `   ${d.message}\n`;

      if (d.plugin_guards && d.tool_guards) {
        report += `   Plugin guards: ${d.plugin_guards.map(g => g.guard).join(', ')}\n`;
        report += `   Tool guards: ${d.tool_guards.map(g => g.guard).join(', ')}\n`;
      }
    }
  }

  return report;
}

// Export additional functions for use in validationMode.ts
export { highlightMismatchedRegions };