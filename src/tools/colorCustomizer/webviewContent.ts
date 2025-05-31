/**
 * Webview content for the Color Customizer
 * This file contains the JavaScript for the color customizer webview
 */

import * as fs from 'fs';
import * as path from 'path';
import { GUARD_TAG_PATTERNS } from '../../utils/regexCache';

export function getWebviewStyles(): string {
  try {
    // Read CSS from external file (webpack copies it to tools/colorCustomizer/styles.css)
    const cssPath = path.join(__dirname, 'tools', 'colorCustomizer', 'styles.css');
    return fs.readFileSync(cssPath, 'utf8');
  } catch (error) {
    // This should never happen in production - the CSS file must be bundled
    throw new Error(`Critical error: styles.css not found at ${path.join(__dirname, 'tools', 'colorCustomizer', 'styles.css')}. This indicates a packaging issue.`);
  }
}

export function getWebviewJavaScript(previewLines: any[]): string {
  // Read the guard parser for webview
  const guardParserPath = path.join(__dirname, 'tools', 'colorCustomizer', 'webviewGuardParser.js');
  const guardParserContent = fs.readFileSync(guardParserPath, 'utf8');

  // Read the shared color rendering engine for webview
  const enginePath = path.join(__dirname, 'tools', 'colorCustomizer', 'colorRenderingEngineWebview.js');
  const engineContent = fs.readFileSync(enginePath, 'utf8');

  // Read the webview JavaScript from external file
  const jsPath = path.join(__dirname, 'tools', 'colorCustomizer', 'webview.js');
  const jsContent = fs.readFileSync(jsPath, 'utf8');

  // Initialize the pattern source from regexCache (single source of truth)
  const patternInitialization = `
// Initialize guard tag pattern from extension (single source of truth)
if (window.GuardParser && window.GuardParser.setPatternSource) {
  window.GuardParser.setPatternSource('${GUARD_TAG_PATTERNS.PARSE_GUARD_TAG.source}');
}
`;

  // Combine everything - guard parser first, then pattern initialization, then engine and webview
  const combinedJs = guardParserContent + '\n\n' + patternInitialization + '\n\n' + engineContent + '\n\n' + jsContent;

  // Replace the PREVIEW_LINES placeholder with actual data
  return combinedJs.replace('__PREVIEW_LINES_PLACEHOLDER__', JSON.stringify(previewLines));
}