import type { ExtensionContext } from 'vscode';
import { window } from 'vscode';
import { UTILITY_PATTERNS } from '../cache/regexCache';

export const EXTENSION_NAME = 'tumee-vscode-plugin';

export const getExtensionWithOptionalName = (name?: string): string => {
  return name ? `${EXTENSION_NAME}.${name}` : EXTENSION_NAME;
};

export const cleanPath = (path: string): string => {
  return path.replace(UTILITY_PATTERNS.BACKSLASH, '/').replace(UTILITY_PATTERNS.TRAILING_SLASH, '');
};

export const firstTimeRun = (context: ExtensionContext): void => {
  const hasRun = context.globalState.get('hasRun');
  if (!hasRun) {
    void context.globalState.update('hasRun', true);
    // Extension is active - no notification needed
  }
};

export * from './fs';