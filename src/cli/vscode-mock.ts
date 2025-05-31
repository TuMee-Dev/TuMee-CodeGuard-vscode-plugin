/**
 * Mock VSCode API for CLI usage
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock workspace configuration
const getConfiguration = (namespace?: string) => ({
  get: (key: string, defaultValue?: any) => {
    try {
      const platform = os.platform();
      const homeDir = os.homedir();
      let settingsPath: string;
      
      if (platform === 'darwin') {
        settingsPath = path.join(homeDir, 'Library', 'Application Support', 'Code', 'User', 'settings.json');
      } else if (platform === 'win32') {
        settingsPath = path.join(process.env.APPDATA || '', 'Code', 'User', 'settings.json');
      } else {
        settingsPath = path.join(homeDir, '.config', 'Code', 'User', 'settings.json');
      }
      
      if (fs.existsSync(settingsPath)) {
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        const fullKey = namespace ? `${namespace}.${key}` : key;
        return settings[fullKey] !== undefined ? settings[fullKey] : defaultValue;
      }
    } catch (e) {
      // Fall back to default
    }
    return defaultValue;
  },
  update: async () => {}
});

export const workspace = {
  getConfiguration,
  fs: {
    readFile: async (uri: any) => {
      const filePath = typeof uri === 'string' ? uri : (uri.fsPath || uri.path || uri.toString());
      const buffer = fs.readFileSync(filePath);
      return { buffer };
    }
  }
};

export const Uri = {
  joinPath: (base: any, ...segments: string[]) => {
    const basePath = typeof base === 'string' ? base : (base.fsPath || base.path || base.extensionUri?.fsPath || base.toString());
    const fullPath = path.join(basePath, ...segments);
    return { 
      toString: () => fullPath,
      fsPath: fullPath,
      path: fullPath
    };
  },
  file: (path: string) => ({
    fsPath: path,
    path: path,
    toString: () => path
  })
};

export const window = {
  showErrorMessage: (message: string) => {
    console.error(`Error: ${message}`);
  },
  showWarningMessage: (message: string) => {
    console.warn(`Warning: ${message}`);
  },
  showInformationMessage: (message: string) => {
    console.log(`Info: ${message}`);
  }
};

// Export other common VSCode types
export const EventEmitter = class {
  fire() {}
  event = () => {};
};

export const Disposable = class {
  static from(...disposables: any[]) {
    return new Disposable();
  }
  dispose() {}
};