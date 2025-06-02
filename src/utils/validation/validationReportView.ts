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
import { processTemplate } from '../rendering/templateLoader';

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

export async function showValidationReport(
  context: ExtensionContext,
  result: ValidationResult
): Promise<void> {
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
    validationPanel.webview.html = await getWebviewContent(result);
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
    const html = await getWebviewContent(result);

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

async function getWebviewContent(result: ValidationResult): Promise<string> {
  const statusClass = result.status === ValidationStatus.Match ? 'success' : 'error';
  const statusIcon = result.status === ValidationStatus.Match ? '✅' : '❌';

  const statisticsHtml = result.statistics ? getStatisticsHtml(result.statistics) : '';
  const discrepanciesHtml = (result.discrepancies && result.discrepancies.length > 0)
    ? getDiscrepanciesHtml(result)
    : getSuccessHtml();

  return processTemplate('validation-report-template.html', {
    FILE_PATH: result.file_path,
    STATUS_CLASS: statusClass,
    STATUS_ICON: statusIcon,
    STATUS: result.status,
    TIMESTAMP: new Date(result.timestamp).toLocaleString(),
    STATISTICS_HTML: statisticsHtml,
    DISCREPANCIES_HTML: discrepanciesHtml
  });
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