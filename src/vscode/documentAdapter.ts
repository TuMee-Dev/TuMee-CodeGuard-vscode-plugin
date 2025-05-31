/**
 * VSCode to Core module adapter
 * Bridges VSCode types to platform-agnostic core interfaces
 */

import type * as vscode from 'vscode';
import type { IDocument, ITextLine, IExtensionContext } from '../core/types';

/**
 * Adapts VSCode TextDocument to core IDocument interface
 */
export class VSCodeDocumentAdapter implements IDocument {
  constructor(private document: vscode.TextDocument) {}

  get text(): string {
    return this.document.getText();
  }

  get languageId(): string {
    return this.document.languageId;
  }

  get lineCount(): number {
    return this.document.lineCount;
  }

  getText(): string {
    return this.document.getText();
  }

  lineAt(line: number): ITextLine {
    const vscodeLine = this.document.lineAt(line);
    return new VSCodeTextLineAdapter(vscodeLine);
  }
}

/**
 * Adapts VSCode TextLine to core ITextLine interface
 */
export class VSCodeTextLineAdapter implements ITextLine {
  constructor(private line: vscode.TextLine) {}

  get lineNumber(): number {
    return this.line.lineNumber;
  }

  get text(): string {
    return this.line.text;
  }
}

/**
 * Adapts VSCode ExtensionContext to core IExtensionContext interface
 */
export class VSCodeExtensionContextAdapter implements IExtensionContext {
  constructor(private context: vscode.ExtensionContext) {}

  get extensionPath(): string {
    return this.context.extensionPath;
  }

  asAbsolutePath(relativePath: string): string {
    return this.context.asAbsolutePath(relativePath);
  }
}