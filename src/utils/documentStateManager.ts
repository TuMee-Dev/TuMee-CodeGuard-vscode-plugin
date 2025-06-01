import type { TextDocument, TextDocumentChangeEvent } from 'vscode';
import type { TextChange, ParseResult } from './cliWorker';
import type { GuardTag, LinePermission } from '@/types/guardTypes';

/**
 * Represents the state of a document being tracked
 */
interface DocumentState {
  fileName: string;
  languageId: string;
  content: string;
  version: number;
  lastParseResult?: ParseResult;
}

/**
 * Manages document state and calculates deltas for the CLI worker
 */
export class DocumentStateManager {
  private currentDocument?: DocumentState;

  /**
   * Set the current document (initial load or document switch)
   */
  setDocument(document: TextDocument): boolean {
    const newState: DocumentState = {
      fileName: document.fileName,
      languageId: document.languageId,
      content: document.getText(),
      version: document.version
    };

    // Check if this is actually a new document
    const isNewDocument = !this.currentDocument || 
      this.currentDocument.fileName !== newState.fileName ||
      this.currentDocument.languageId !== newState.languageId;

    this.currentDocument = newState;
    return isNewDocument;
  }

  /**
   * Update document content and calculate delta changes
   */
  updateDocument(event: TextDocumentChangeEvent): TextChange[] | null {
    if (!this.currentDocument) {
      // No current document, treat as new document
      return null;
    }

    if (event.document.fileName !== this.currentDocument.fileName) {
      // Different document, ignore
      return null;
    }

    const changes: TextChange[] = [];

    // Convert VSCode content changes to our TextChange format
    for (const contentChange of event.contentChanges) {
      // VSCode provides range-based changes
      if ('range' in contentChange) {
        changes.push({
          startLine: contentChange.range.start.line,
          startChar: contentChange.range.start.character,
          endLine: contentChange.range.end.line,
          endChar: contentChange.range.end.character,
          newText: contentChange.text
        });
      } else {
        // Full document change (shouldn't happen with incremental sync)
        // Fall back to setting entire document
        return null;
      }
    }

    // Update our state
    this.currentDocument.content = event.document.getText();
    this.currentDocument.version = event.document.version;

    return changes.length > 0 ? changes : null;
  }

  /**
   * Update the parse result for the current document
   */
  updateParseResult(result: ParseResult): void {
    if (this.currentDocument) {
      this.currentDocument.lastParseResult = result;
    }
  }

  /**
   * Get current document state
   */
  getCurrentDocument(): DocumentState | undefined {
    return this.currentDocument;
  }

  /**
   * Get last parse result for current document
   */
  getLastParseResult(): ParseResult | undefined {
    return this.currentDocument?.lastParseResult;
  }

  /**
   * Check if we have a current document
   */
  hasCurrentDocument(): boolean {
    return this.currentDocument !== undefined;
  }

  /**
   * Clear current document state
   */
  clearCurrentDocument(): void {
    this.currentDocument = undefined;
  }

  /**
   * Get document info for CLI worker
   */
  getDocumentInfo(): { fileName: string; languageId: string; content: string } | null {
    if (!this.currentDocument) {
      return null;
    }

    return {
      fileName: this.currentDocument.fileName,
      languageId: this.currentDocument.languageId,
      content: this.currentDocument.content
    };
  }

  /**
   * Check if document content has changed since last parse
   */
  hasContentChanged(document: TextDocument): boolean {
    if (!this.currentDocument) {
      return true; // No current document, so it's definitely changed
    }

    return this.currentDocument.version !== document.version ||
           this.currentDocument.content !== document.getText();
  }

  /**
   * Validate that a delta can be applied to current document
   */
  validateDelta(changes: TextChange[]): boolean {
    if (!this.currentDocument) {
      return false;
    }

    const content = this.currentDocument.content;
    const lines = content.split('\n');

    // Basic validation - check that line/character positions are valid
    for (const change of changes) {
      // Check start position
      if (change.startLine < 0 || change.startLine >= lines.length) {
        return false;
      }

      if (change.startChar < 0 || change.startChar > lines[change.startLine].length) {
        return false;
      }

      // Check end position
      if (change.endLine < 0 || change.endLine >= lines.length) {
        return false;
      }

      if (change.endChar < 0 || change.endChar > lines[change.endLine].length) {
        return false;
      }

      // Check that end position is after start position
      if (change.endLine < change.startLine ||
          (change.endLine === change.startLine && change.endChar < change.startChar)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Apply delta changes to current document content (for testing/validation)
   */
  private applyDeltaToContent(content: string, changes: TextChange[]): string {
    const lines = content.split('\n');

    // Sort changes by position (end to start) to avoid position shifting
    const sortedChanges = [...changes].sort((a, b) => {
      if (a.startLine !== b.startLine) {
        return b.startLine - a.startLine;
      }
      return b.startChar - a.startChar;
    });

    for (const change of sortedChanges) {
      if (change.startLine === change.endLine) {
        // Single line change
        const line = lines[change.startLine];
        const newLine = line.substring(0, change.startChar) +
                       change.newText +
                       line.substring(change.endChar);
        lines[change.startLine] = newLine;
      } else {
        // Multi-line change
        const firstLine = lines[change.startLine];
        const lastLine = lines[change.endLine];
        
        const newContent = firstLine.substring(0, change.startChar) +
                          change.newText +
                          lastLine.substring(change.endChar);

        // Replace the affected lines with the new content
        const newLines = newContent.split('\n');
        lines.splice(change.startLine, change.endLine - change.startLine + 1, ...newLines);
      }
    }

    return lines.join('\n');
  }

  /**
   * Verify delta produces expected content (for debugging)
   */
  verifyDelta(originalContent: string, changes: TextChange[], expectedContent: string): boolean {
    try {
      const result = this.applyDeltaToContent(originalContent, changes);
      return result === expectedContent;
    } catch {
      return false;
    }
  }

  /**
   * Convert parse result to compatible format for VSCode extension
   */
  convertToLegacyFormat(result: ParseResult): {
    guardTags: GuardTag[];
    linePermissions: Map<number, LinePermission>;
  } {
    // Convert linePermissions array to Map (1-based line numbers)
    const linePermissionsMap = new Map<number, LinePermission>();
    
    for (const permission of result.linePermissions) {
      linePermissionsMap.set(permission.line, permission);
    }

    return {
      guardTags: result.guardTags,
      linePermissions: linePermissionsMap
    };
  }
}