const { parseGuardTags } = require('../dist/extension');
const assert = require('assert');

// Mock VSCode
const vscode = {
  TextDocument: class TextDocument {
    constructor(lines) {
      this.lines = lines;
      this.lineCount = lines.length;
      this.languageId = 'python';
    }
    getText() {
      return this.lines.join('\n');
    }
    lineAt(line) {
      return {
        text: this.lines[line],
        firstNonWhitespaceCharacterIndex: this.lines[line].search(/\S/)
      };
    }
  }
};

describe('Context scope trimming', () => {
  it('should trim trailing empty lines from context scope', async () => {
    const lines = [
      '# @guard:ai:context',
      '# Performance Tuning Context',
      '# Current benchmarks:',
      '# - Key retrieval: p50=2ms, p95=8ms, p99=15ms',
      '# - Encryption overhead: ~0.5ms per operation',
      '# - Cache hit ratio: 85% in production',
      '# - Memory footprint: 50MB baseline + 1KB per cached key',
      '# Suggested improvements: Consider Redis for distributed caching',
      '',  // Empty line 8 - should NOT be included in context
      '# @guard:ai:n',
      '# HSM integration credentials',
      'HSM_CONFIG = {'
    ];

    const doc = new vscode.TextDocument(lines);
    const guards = await parseGuardTags(doc, lines);

    // Find the context guard
    const contextGuard = guards.find(g => g.permission === 'context');
    assert(contextGuard, 'Context guard not found');

    // Context should end at line 8 (the last comment line), not line 9 (empty line)
    assert.strictEqual(contextGuard.endLine, 8, 
      `Context guard should end at line 8 (last content), but ends at line ${contextGuard.endLine}`);
  });

  it('should handle multiple trailing empty lines', async () => {
    const lines = [
      '# @guard:ai:context',
      '# Another context example with trailing empty lines',
      '# This is documentation line 1',
      '# This is documentation line 2',
      '# This is the last content line',
      '',  // Empty line 5
      '',  // Empty line 6
      '',  // Empty line 7
      '# @guard:ai:r',
      '# This is a read-only section',
      'def process_data():'
    ];

    const doc = new vscode.TextDocument(lines);
    const guards = await parseGuardTags(doc, lines);

    // Find the context guard
    const contextGuard = guards.find(g => g.permission === 'context');
    assert(contextGuard, 'Context guard not found');

    // Context should end at line 5 (the last comment line with content)
    assert.strictEqual(contextGuard.endLine, 5, 
      `Context guard should end at line 5 (last content), but ends at line ${contextGuard.endLine}`);
  });

  it('should handle context with no trailing empty lines', async () => {
    const lines = [
      '# @guard:ai:context',
      '# Context without trailing empty lines',
      '# This goes directly to code',
      '# @guard:ai:n',
      'SECRET_KEY = "abc123"'
    ];

    const doc = new vscode.TextDocument(lines);
    const guards = await parseGuardTags(doc, lines);

    // Find the context guard
    const contextGuard = guards.find(g => g.permission === 'context');
    assert(contextGuard, 'Context guard not found');

    // Context should end at line 3 (last comment before next guard)
    assert.strictEqual(contextGuard.endLine, 3, 
      `Context guard should end at line 3, but ends at line ${contextGuard.endLine}`);
  });
});

// Run tests if executed directly
if (require.main === module) {
  describe('Context scope trimming', () => {
    // Run all test cases
  });
}