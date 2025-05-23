// Validation mode implementation for comparing plugin and CLI guard parsing
// This is a developer/testing feature, not part of normal user workflow

import type { OutputChannel, ExtensionContext, Disposable } from 'vscode';
import { window, workspace, ProgressLocation, commands } from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getAclCliPath, isCliAvailable } from './acl';
import { parseGuardTags } from './guardProcessor';
// import { getLanguageForDocument } from './scopeResolver';
import { showValidationReport } from './validationReportView';
import { ValidationStatus } from '@/types/validationTypes';
import type {
  ValidationPackage,
  ValidationRequest,
  GuardRegion,
  LineCoverage,
  ValidationResult,
  ValidationExitCode,
  ParsedGuard
} from '@/types/validationTypes';
import type { GuardTag } from '@/types/guardTypes';

const execAsync = promisify(exec);

let validationOutputChannel: OutputChannel;

function getOutputChannel(): OutputChannel {
  if (!validationOutputChannel) {
    validationOutputChannel = window.createOutputChannel('CodeGuard Validation');
  }
  return validationOutputChannel;
}

function logDebug(message: string): void {
  const channel = getOutputChannel();
  channel.appendLine(`[DEBUG] ${new Date().toISOString()} - ${message}`);
}

function logError(message: string): void {
  const channel = getOutputChannel();
  channel.appendLine(`[ERROR] ${new Date().toISOString()} - ${message}`);
}

function logInfo(message: string): void {
  const channel = getOutputChannel();
  channel.appendLine(`[INFO] ${new Date().toISOString()} - ${message}`);
}

async function getFileHash(filePath: string): Promise<string> {
  const content = await fs.promises.readFile(filePath, 'utf8');
  return crypto.createHash('sha256').update(content).digest('hex');
}

function getPluginVersion(): string {
  // In a real implementation, this would read from package.json
  return '1.0.0';
}

function convertGuardTagToParsedGuard(tag: GuardTag, raw: string): ParsedGuard {
  // Map our internal GuardTag to the validation ParsedGuard format
  let permission: 'read-only' | 'write' | 'none';

  switch (tag.permission) {
    case 'r':
      permission = 'read-only';
      break;
    case 'w':
      permission = 'write';
      break;
    case 'n':
      permission = 'none';
      break;
    case 'context':
      permission = 'read-only'; // Treat context as read-only
      break;
    default:
      permission = 'read-only';
  }

  // Determine target
  const target: 'ai' | 'human' | 'all' = tag.target as 'ai' | 'human';

  return {
    raw: raw,
    target: target,
    identifiers: tag.identifier ? [tag.identifier] : ['*'],
    permission,
    scope: (tag.scope || 'file') as 'file' | 'function' | 'class' | 'block' | 'section',
    scope_modifiers: []
  };
}

async function buildValidationPackage(
  filePath: string,
  guardTags: GuardTag[]
): Promise<ValidationPackage> {
  const fileContent = await fs.promises.readFile(filePath, 'utf8');
  const lines = fileContent.split('\n');
  const totalLines = lines.length;
  const fileHash = await getFileHash(filePath);

  // Convert GuardTags to GuardRegions
  const guardRegions: GuardRegion[] = guardTags.map((tag, index) => {
    // Build the raw guard tag string from components
    const raw = `@guard:${tag.target}${tag.identifier ? `:${  tag.identifier}` : ''}:${tag.permission}${tag.scope ? `.${  tag.scope}` : ''}`;

    // Calculate region boundaries
    const startLine = tag.lineNumber;
    const endLine = tag.scopeEnd || (tag.lineNumber + (tag.lineCount || 0)) || totalLines;

    const contentLines = lines.slice(startLine - 1, endLine);
    const regionContent = contentLines.join('\n');
    const contentHash = crypto.createHash('sha256').update(regionContent).digest('hex');
    const contentPreview = `${contentLines[0]?.substring(0, 50)  }...` || '';

    return {
      index,
      guard: raw,
      parsed_guard: convertGuardTagToParsedGuard(tag, raw),
      declaration_line: tag.lineNumber,
      start_line: startLine,
      end_line: endLine,
      content_hash: contentHash,
      content_preview: contentPreview
    };
  });

  // Compute line coverage
  const lineCoverage = computeLineCoverage(guardRegions, totalLines);

  // Get language info from document
  const document = await workspace.openTextDocument(filePath);
  const language = document.languageId || 'unknown';

  const validationRequest: ValidationRequest = {
    file_path: filePath,
    file_hash: fileHash,
    total_lines: totalLines,
    timestamp: new Date().toISOString(),
    plugin_version: getPluginVersion(),
    plugin_name: 'TuMee VSCode Plugin',
    guard_regions: guardRegions,
    line_coverage: lineCoverage,
    validation_metadata: {
      parser_used: 'tree-sitter',
      language: language,
      encoding: 'utf-8',
      supports_overlapping: true
    }
  };

  return {
    validation_request: validationRequest
  };
}

function computeLineCoverage(regions: GuardRegion[], totalLines: number): LineCoverage[] {
  const coverage: LineCoverage[] = [];

  for (let line = 1; line <= totalLines; line++) {
    const applicableGuards = regions
      .filter(r => line >= r.start_line && line <= r.end_line)
      .map(r => r.index);

    coverage.push({
      line,
      guards: applicableGuards
    });
  }

  return coverage;
}

function parseValidationResponse(output: string): ValidationResult {
  try {
    const result = JSON.parse(output) as ValidationResult;
    // Ensure all required fields exist
    if (!result.discrepancies) {
      result.discrepancies = [];
    }
    if (!result.statistics) {
      result.statistics = {
        total_lines: 0,
        plugin_guard_regions: 0,
        tool_guard_regions: 0,
        matching_regions: 0,
        max_overlapping_guards: 0,
        lines_with_multiple_guards: 0,
        discrepancy_count: 0,
        affected_lines: 0
      };
    }
    return result;
  } catch (error) {
    logError(`Failed to parse validation response: ${String(error)}`);
    logError(`Raw output was: ${output}`);
    throw new Error(`Failed to parse validation response: ${String(error)}`);
  }
}

function parseErrorResponse(output: string, exitCode: number): ValidationResult {
  // Try to parse JSON response, or create a basic error response
  try {
    return JSON.parse(output) as ValidationResult;
  } catch {
    return {
      status: 'ERROR_INTERNAL' as ValidationStatus,
      exit_code: exitCode as ValidationExitCode,
      file_path: '',
      timestamp: new Date(),
      plugin_version: getPluginVersion(),
      discrepancies: [],
      statistics: {
        total_lines: 0,
        plugin_guard_regions: 0,
        tool_guard_regions: 0,
        matching_regions: 0,
        max_overlapping_guards: 0,
        lines_with_multiple_guards: 0,
        discrepancy_count: 0,
        affected_lines: 0
      }
    };
  }
}

function showValidationResults(context: ExtensionContext, result: ValidationResult): void {
  // Log to output channel for debugging
  logInfo(`Validation completed with status: ${result.status}`);

  // Show the visual report in webview
  showValidationReport(context, result);

  // Also log summary to output channel
  if (result.discrepancies && result.discrepancies.length > 0) {
    logInfo(`Found ${result.discrepancies.length} discrepancies`);
  } else if (result.status === ValidationStatus.Match) {
    logInfo('✅ SUCCESS: Guard parsing matches perfectly!');
  }
}

async function handleValidationResponse(
  exitCode: number,
  output: string,
  error: string
): Promise<ValidationResult> {
  logDebug(`Exit Code: ${exitCode}`);
  logDebug(`Output: ${output}`);
  if (error) {
    logDebug(`Error: ${error}`);
  }

  switch (exitCode) {
    case 0: { // SUCCESS
      const successResult = parseValidationResponse(output);
      // Ensure discrepancies array exists even for success
      if (!successResult.discrepancies) {
        successResult.discrepancies = [];
      }
      await window.showInformationMessage('Validation successful - guard parsing matches perfectly!');
      return successResult;
    }

    case 1: { // VALIDATION_MISMATCH
      const mismatchResult = parseValidationResponse(output);
      // Ensure discrepancies array exists
      if (!mismatchResult.discrepancies) {
        mismatchResult.discrepancies = [];
      }
      const errorCount = mismatchResult.discrepancies.filter(d => d.severity === 'ERROR').length;
      const warningCount = mismatchResult.discrepancies.filter(d => d.severity === 'WARNING').length;
      await window.showWarningMessage(
        `Validation found ${errorCount} errors and ${warningCount} warnings. Check the output panel for details.`
      );
      return mismatchResult;
    }

    case 2: // PARSING_ERROR
      logError(`CodeGuard parsing error: ${error}`);
      await window.showErrorMessage(
        'The CodeGuard tool could not parse the file. This may indicate a syntax error or unsupported language construct.'
      );
      return parseErrorResponse(output, exitCode);

    case 3: // JSON_ERROR
      logError(`JSON format error: ${error}`);
      await window.showErrorMessage(
        'The plugin generated invalid data for validation. Please report this issue.'
      );
      throw new Error('Plugin generated invalid JSON for validation');

    case 4: // FILE_NOT_FOUND
      await window.showErrorMessage(
        'The file could not be found. Please ensure the file exists and try again.'
      );
      return parseErrorResponse(output, exitCode);

    case 5: // FILE_CHANGED
      await window.showWarningMessage(
        'The file has been modified since parsing began. Please save your changes and retry validation.'
      );
      return parseErrorResponse(output, exitCode);

    case 6: // VERSION_INCOMPATIBLE
      await window.showErrorMessage(
        'The plugin version is not compatible with the CodeGuard tool version. Please update.'
      );
      return parseErrorResponse(output, exitCode);

    case 7: // INTERNAL_ERROR
      logError(`Internal tool error: ${error}`);
      await window.showErrorMessage(
        'An unexpected error occurred in the CodeGuard tool. Error details have been logged.'
      );
      return parseErrorResponse(output, exitCode);

    default:
      logError(`Unknown exit code: ${exitCode}`);
      throw new Error(`Unknown exit code from CodeGuard: ${exitCode}`);
  }
}

export async function validateGuardSections(context: ExtensionContext): Promise<void> {
  const activeEditor = window.activeTextEditor;
  if (!activeEditor) {
    await window.showErrorMessage('No active editor. Please open a file to validate.');
    return;
  }

  const document = activeEditor.document;
  if (document.isUntitled) {
    await window.showErrorMessage('Cannot validate unsaved files. Please save the file first.');
    return;
  }

  const filePath = document.fileName;
  let tempFile: string | undefined;

  try {
    await window.withProgress({
      location: ProgressLocation.Notification,
      title: 'Validating Guard Sections',
      cancellable: false
    }, async (progress) => {
      // Step 1: Parse guard tags
      progress.report({ message: 'Parsing guard tags...', increment: 20 });
      const fileContent = document.getText();
      const lines = fileContent.split('\n');
      const guardTags = await parseGuardTags(document, lines);
      logInfo(`Found ${guardTags.length} guard regions`);

      // Step 2: Build validation package
      progress.report({ message: 'Building validation package...', increment: 20 });
      const validationPackage = await buildValidationPackage(filePath, guardTags);

      // Step 3: Save to temp file
      progress.report({ message: 'Creating validation request...', increment: 20 });
      const jsonPayload = JSON.stringify(validationPackage, null, 2);
      tempFile = path.join(os.tmpdir(), `codeguard-validation-${Date.now()}.json`);
      await fs.promises.writeFile(tempFile, jsonPayload, 'utf8');
      logDebug(`Created temp file: ${tempFile}`);

      // Step 4: Execute validation command
      progress.report({ message: 'Running validation...', increment: 20 });
      const cliPath = getAclCliPath();
      
      // Check if CLI exists first
      const cliAvailable = await isCliAvailable();
      if (!cliAvailable) {
        logError(`CodeGuard CLI not found at: ${cliPath}`);
        throw new Error(`CodeGuard CLI not found. Please ensure 'codeguard' is installed and in your PATH, or configure the path in settings.`);
      }
      
      const command = `"${cliPath}" validate-sections --json-file "${tempFile}"`;
      logDebug(`Executing: ${command}`);

      try {
        const { stdout, stderr } = await execAsync(command, {
          timeout: 30000 // 30 second timeout
        });

        // Step 5: Handle response
        progress.report({ message: 'Processing results...', increment: 20 });
        const result = await handleValidationResponse(0, stdout, stderr);
        showValidationResults(context, result);

      } catch (error) {
        const execError = error as { code?: number; stdout?: string; stderr?: string; message?: string };
        logError(`Command execution failed: ${String(error)}`);
        logError(`Exit code: ${execError.code}`);
        logError(`Stdout: ${execError.stdout || 'empty'}`);
        logError(`Stderr: ${execError.stderr || 'empty'}`);
        
        const exitCode = execError.code || 7;
        const result = await handleValidationResponse(
          exitCode,
          execError.stdout || '',
          execError.stderr || execError.message || String(error)
        );
        showValidationResults(context, result);
      }
    });

  } catch (error) {
    logError(`Validation failed: ${String(error)}`);
    await window.showErrorMessage(
      `Failed to validate guard sections: ${error instanceof Error ? error.message : String(error)}`
    );
  } finally {
    // Cleanup temp file
    if (tempFile && fs.existsSync(tempFile)) {
      try {
        await fs.promises.unlink(tempFile);
        logDebug(`Deleted temp file: ${tempFile}`);
      } catch (error) {
        logError(`Failed to delete temp file: ${String(error)}`);
      }
    }
  }
}

export function registerValidationCommands(context: ExtensionContext): Disposable[] {
  const disposables: Disposable[] = [];

  // Register the main validation command
  disposables.push(
    commands.registerCommand('tumee-vscode-plugin.validateSectionParsing', () =>
      validateGuardSections(context)
    )
  );

  // Register command to show validation output
  disposables.push(
    commands.registerCommand('tumee-vscode-plugin.showValidationOutput', () => {
      const channel = getOutputChannel();
      channel.show();
    })
  );

  return disposables;
}