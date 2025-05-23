import type { TextDocument, TextDocumentChangeEvent } from 'vscode';
import { logError } from './errorHandler';
import type { GuardTag } from '../types/guardTypes';
import { parseGuardTag } from './acl';
import { resolveSemantic } from './scopeResolver';

interface DocumentCache {
  version: number;
  guardTags: GuardTag[];
  lineHashes: Map<number, string>;
}

/**
 * Incremental parser for guard tags
 * Only re-parses changed portions of documents
 */
export class IncrementalGuardParser {
  private documentCache = new Map<string, DocumentCache>();

  /**
   * Parse guard tags incrementally based on document changes
   */
  async parseIncremental(document: TextDocument, changeEvent?: TextDocumentChangeEvent): Promise<GuardTag[]> {
    const cacheKey = document.uri.toString();
    const cachedData = this.documentCache.get(cacheKey);

    // If no cache or version mismatch, do full parse
    if (!cachedData || cachedData.version !== document.version || !changeEvent) {
      return this.fullParse(document);
    }

    // If no content changes, return cached result
    if (changeEvent.contentChanges.length === 0) {
      return cachedData.guardTags;
    }

    // Determine affected lines
    const affectedLines = new Set<number>();

    for (const change of changeEvent.contentChanges) {
      // Get the range of lines affected by this change
      const startLine = change.range.start.line;
      const endLine = change.range.end.line;

      // Calculate how many lines were added/removed
      const oldLineCount = endLine - startLine + 1;
      const newLineCount = change.text.split('\n').length;
      const lineDelta = newLineCount - oldLineCount;

      // Mark affected lines
      for (let line = startLine; line <= Math.max(endLine, startLine + newLineCount - 1); line++) {
        affectedLines.add(line);
      }

      // Update line numbers for tags after the change
      if (lineDelta !== 0) {
        this.shiftTagLines(cachedData.guardTags, endLine + 1, lineDelta);
      }
    }

    // Remove tags from affected lines
    cachedData.guardTags = cachedData.guardTags.filter(tag => {
      const tagLine = this.getTagLine(tag, document);
      return !affectedLines.has(tagLine);
    });

    // Re-parse affected lines
    const newTags: GuardTag[] = [];

    for (const lineNum of affectedLines) {
      if (lineNum >= document.lineCount) continue;

      const line = document.lineAt(lineNum);
      const lineText = line.text;

      // Update line hash
      cachedData.lineHashes.set(lineNum, this.hashLine(lineText));

      // Parse guard tags using the same logic as the regular parser
      const tagInfo = parseGuardTag(lineText);
      if (tagInfo) {
        // If there's a semantic scope, resolve it to line numbers
        if (tagInfo.scope && !tagInfo.lineCount) {
          try {
            const scopeBoundary = await resolveSemantic(
              document,
              lineNum,
              tagInfo.scope,
              tagInfo.addScopes,
              tagInfo.removeScopes
            );

            if (scopeBoundary) {
              // For semantic scopes, we need to handle the range differently
              const tag: GuardTag = {
                lineNumber: scopeBoundary.startLine,
                target: tagInfo.target as 'ai' | 'human',
                identifier: tagInfo.identifier,
                permission: tagInfo.permission as 'r' | 'w' | 'n' | 'context',
                scope: tagInfo.scope,
                lineCount: scopeBoundary.endLine - scopeBoundary.startLine + 1,
                addScopes: tagInfo.addScopes,
                removeScopes: tagInfo.removeScopes,
                scopeStart: scopeBoundary.startLine,
                scopeEnd: scopeBoundary.endLine
              };
              newTags.push(tag);
            } else {
              // If scope resolution fails, treat as unbounded
              const tag: GuardTag = {
                lineNumber: lineNum,
                target: tagInfo.target as 'ai' | 'human',
                identifier: tagInfo.identifier,
                permission: tagInfo.permission as 'r' | 'w' | 'n' | 'context',
                scope: tagInfo.scope,
                lineCount: tagInfo.lineCount,
                addScopes: tagInfo.addScopes,
                removeScopes: tagInfo.removeScopes
              };
              newTags.push(tag);
            }
          } catch (error) {
            logError(error, 'incrementalParser.parseIncremental');
            // On error, add tag without scope resolution
            const tag: GuardTag = {
              lineNumber: lineNum,
              target: tagInfo.target as 'ai' | 'human',
              identifier: tagInfo.identifier,
              permission: tagInfo.permission as 'r' | 'w' | 'n' | 'context',
              scope: tagInfo.scope,
              lineCount: tagInfo.lineCount,
              addScopes: tagInfo.addScopes,
              removeScopes: tagInfo.removeScopes
            };
            newTags.push(tag);
          }
        } else {
          // Regular line count or unbounded
          const tag: GuardTag = {
            lineNumber: lineNum,
            target: tagInfo.target as 'ai' | 'human',
            identifier: tagInfo.identifier,
            permission: tagInfo.permission as 'r' | 'w' | 'n' | 'context',
            scope: tagInfo.scope,
            lineCount: tagInfo.lineCount,
            addScopes: tagInfo.addScopes,
            removeScopes: tagInfo.removeScopes
          };
          newTags.push(tag);
        }
      }
    }

    // Merge new tags with existing ones
    cachedData.guardTags.push(...newTags);
    cachedData.guardTags.sort((a, b) => a.lineNumber - b.lineNumber);
    cachedData.version = document.version;

    return cachedData.guardTags;
  }

  /**
   * Perform a full parse of the document
   */
  private async fullParse(document: TextDocument): Promise<GuardTag[]> {
    const guardTags: GuardTag[] = [];
    const lineHashes = new Map<number, string>();

    for (let i = 0; i < document.lineCount; i++) {
      const line = document.lineAt(i);
      const lineText = line.text;

      // Store line hash for future comparison
      lineHashes.set(i, this.hashLine(lineText));

      // Parse guard tags using the same logic as the regular parser
      const tagInfo = parseGuardTag(lineText);
      if (tagInfo) {
        // If there's a semantic scope, resolve it to line numbers
        if (tagInfo.scope && !tagInfo.lineCount) {
          try {
            const scopeBoundary = await resolveSemantic(
              document,
              i,
              tagInfo.scope,
              tagInfo.addScopes,
              tagInfo.removeScopes
            );

            if (scopeBoundary) {
              // For semantic scopes, we need to handle the range differently
              const tag: GuardTag = {
                lineNumber: scopeBoundary.startLine,
                target: tagInfo.target as 'ai' | 'human',
                identifier: tagInfo.identifier,
                permission: tagInfo.permission as 'r' | 'w' | 'n' | 'context',
                scope: tagInfo.scope,
                lineCount: scopeBoundary.endLine - scopeBoundary.startLine + 1,
                addScopes: tagInfo.addScopes,
                removeScopes: tagInfo.removeScopes,
                scopeStart: scopeBoundary.startLine,
                scopeEnd: scopeBoundary.endLine
              };
              guardTags.push(tag);
            } else {
              // If scope resolution fails, treat as unbounded
              const tag: GuardTag = {
                lineNumber: i,
                target: tagInfo.target as 'ai' | 'human',
                identifier: tagInfo.identifier,
                permission: tagInfo.permission as 'r' | 'w' | 'n' | 'context',
                scope: tagInfo.scope,
                lineCount: tagInfo.lineCount,
                addScopes: tagInfo.addScopes,
                removeScopes: tagInfo.removeScopes
              };
              guardTags.push(tag);
            }
          } catch (error) {
            logError(error, 'incrementalParser.fullParse');
            // On error, add tag without scope resolution
            const tag: GuardTag = {
              lineNumber: i,
              target: tagInfo.target as 'ai' | 'human',
              identifier: tagInfo.identifier,
              permission: tagInfo.permission as 'r' | 'w' | 'n' | 'context',
              scope: tagInfo.scope,
              lineCount: tagInfo.lineCount,
              addScopes: tagInfo.addScopes,
              removeScopes: tagInfo.removeScopes
            };
            guardTags.push(tag);
          }
        } else {
          // Regular line count or unbounded
          const tag: GuardTag = {
            lineNumber: i,
            target: tagInfo.target as 'ai' | 'human',
            identifier: tagInfo.identifier,
            permission: tagInfo.permission as 'r' | 'w' | 'n' | 'context',
            scope: tagInfo.scope,
            lineCount: tagInfo.lineCount,
            addScopes: tagInfo.addScopes,
            removeScopes: tagInfo.removeScopes
          };
          guardTags.push(tag);
        }
      }
    }

    // Cache the results
    this.documentCache.set(document.uri.toString(), {
      version: document.version,
      guardTags,
      lineHashes
    });

    return guardTags;
  }

  /**
   * Shift line numbers for tags after a change
   */
  private shiftTagLines(tags: GuardTag[], afterLine: number, delta: number): void {
    for (const tag of tags) {
      if (tag.lineNumber >= afterLine) {
        tag.lineNumber += delta;
        // Also update scope boundaries if they exist
        if (tag.scopeStart !== undefined && tag.scopeStart >= afterLine) {
          tag.scopeStart += delta;
        }
        if (tag.scopeEnd !== undefined && tag.scopeEnd >= afterLine) {
          tag.scopeEnd += delta;
        }
      }
    }
  }

  /**
   * Get the line number for a tag
   */
  private getTagLine(tag: GuardTag, _document: TextDocument): number {
    return tag.lineNumber;
  }

  /**
   * Simple hash function for line content
   */
  private hashLine(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Clear cache for a document
   */
  clearCache(document: TextDocument): void {
    this.documentCache.delete(document.uri.toString());
  }

  /**
   * Clear all caches
   */
  clearAllCaches(): void {
    this.documentCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { documentCount: number; totalTags: number } {
    let totalTags = 0;
    for (const cache of this.documentCache.values()) {
      totalTags += cache.guardTags.length;
    }
    return {
      documentCount: this.documentCache.size,
      totalTags
    };
  }
}

// Singleton instance
export const incrementalParser = new IncrementalGuardParser();