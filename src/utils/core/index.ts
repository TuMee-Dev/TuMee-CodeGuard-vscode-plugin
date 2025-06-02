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
    void window.showInformationMessage(
      'TuMee File and Folder Customization is now active. Right-click on a file or folder to customize it.'
    );
  }
};

export * from './fs';