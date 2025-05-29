/**
 * Webview content for the Color Customizer
 * This file contains the JavaScript for the color customizer webview
 */

import * as fs from 'fs';
import * as path from 'path';

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
  // Read the webview JavaScript from external file
  const jsPath = path.join(__dirname, 'tools', 'colorCustomizer', 'webview.js');
  const jsContent = fs.readFileSync(jsPath, 'utf8');
  
  // Replace the PREVIEW_LINES placeholder with actual data
  return jsContent.replace('__PREVIEW_LINES_PLACEHOLDER__', JSON.stringify(previewLines));
}