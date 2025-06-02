/**
 * Centralized configuration management for the extension
 * Provides a singleton interface to VS Code configuration
 */

import type { ConfigurationChangeEvent, Disposable } from 'vscode';
import { workspace, EventEmitter } from 'vscode';
import { getExtensionWithOptionalName } from '../core';
import type { ExtensionItem } from '@/types';
import type { GuardColors } from '../../tools/colorCustomizer/ColorConfigTypes';

/**
 * Configuration keys used by the extension
 */
export const CONFIG_KEYS = {
  // Color and decoration settings
  CURRENT_THEME: 'currentTheme',
  CODE_DECORATION_OPACITY: 'codeDecorationOpacity',
  GUARD_COLORS_COMPLETE: 'guardColorsComplete',
  DEFAULT_AI_WRITE: 'defaultAiWrite',
  DEFAULT_HUMAN_WRITE: 'defaultHumanWrite',

  // Performance settings
  ENABLE_DEBUG_LOGGING: 'enableDebugLogging',
  ENABLE_PERFORMANCE_MONITORING: 'enablePerformanceMonitoring',
  DECORATION_UPDATE_DELAY: 'decorationUpdateDelay',
  MAX_FILE_SIZE: 'maxFileSize',
  ENABLE_CHUNKED_PROCESSING: 'enableChunkedProcessing',
  CHUNK_SIZE: 'chunkSize',

  // ACL settings
  ACL_CLI_PATH: 'aclCliPath',

  // Color configuration
  GUARD_COLORS: 'guardColors',

  // File customization
  ITEMS: 'items',

  // Guard processing
  ENABLE_VALIDATION_MODE: 'enableValidationMode',
  VALIDATION_ON_SAVE: 'validationOnSave',
  VALIDATION_ON_TYPE: 'validationOnType'
} as const;

export type ConfigKey = typeof CONFIG_KEYS[keyof typeof CONFIG_KEYS];

/**
 * Type-safe configuration interface
 */
interface ConfigurationTypes {
  [CONFIG_KEYS.CURRENT_THEME]: string;
  [CONFIG_KEYS.CODE_DECORATION_OPACITY]: number;
  [CONFIG_KEYS.GUARD_COLORS_COMPLETE]: GuardColors;
  [CONFIG_KEYS.DEFAULT_AI_WRITE]: boolean;
  [CONFIG_KEYS.DEFAULT_HUMAN_WRITE]: boolean;
  [CONFIG_KEYS.ENABLE_DEBUG_LOGGING]: boolean;
  [CONFIG_KEYS.ENABLE_PERFORMANCE_MONITORING]: boolean;
  [CONFIG_KEYS.DECORATION_UPDATE_DELAY]: number;
  [CONFIG_KEYS.MAX_FILE_SIZE]: number;
  [CONFIG_KEYS.ENABLE_CHUNKED_PROCESSING]: boolean;
  [CONFIG_KEYS.CHUNK_SIZE]: number;
  [CONFIG_KEYS.ACL_CLI_PATH]: string;
  [CONFIG_KEYS.GUARD_COLORS]: {
    aiWrite?: string;
    aiRead?: string;
    aiNoAccess?: string;
    humanWrite?: string;
    humanRead?: string;
    humanNoAccess?: string;
    opacity?: number;
    useAiColorAsBase?: boolean;
  };
  [CONFIG_KEYS.ITEMS]: Array<ExtensionItem>;
  [CONFIG_KEYS.ENABLE_VALIDATION_MODE]: boolean;
  [CONFIG_KEYS.VALIDATION_ON_SAVE]: boolean;
  [CONFIG_KEYS.VALIDATION_ON_TYPE]: boolean;
}

/**
 * Configuration manager singleton
 */
class ConfigurationManager {
  private static instance: ConfigurationManager;
  private namespace: string;
  private disposables: Disposable[] = [];
  private changeEmitter = new EventEmitter<ConfigKey>();

  private constructor() {
    this.namespace = getExtensionWithOptionalName();

    // Listen for configuration changes
    this.disposables.push(
      workspace.onDidChangeConfiguration(this.handleConfigurationChange.bind(this))
    );
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): ConfigurationManager {
    if (!ConfigurationManager.instance) {
      ConfigurationManager.instance = new ConfigurationManager();
    }
    return ConfigurationManager.instance;
  }

  /**
   * Get a configuration value with type safety
   */
  get<K extends ConfigKey>(key: K): ConfigurationTypes[K];
  get<K extends ConfigKey>(key: K, defaultValue: ConfigurationTypes[K]): ConfigurationTypes[K];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get<T = any>(key: string, defaultValue?: T): T;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get(key: string, defaultValue?: any): any {
    const config = workspace.getConfiguration(this.namespace);
    // Your solution: explicitly handle the any from VSCode's API
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return
    const anyValue = config.get(key, defaultValue);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return anyValue;
  }

  /**
   * Update a configuration value
   */
  async update<K extends ConfigKey>(
    key: K,
    value: ConfigurationTypes[K],
    global?: boolean
  ): Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async update<T = any>(
    key: string,
    value: T,
    global?: boolean
  ): Promise<void>;
  async update(
    key: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value: any,
    global: boolean = true
  ): Promise<void> {
    const config = workspace.getConfiguration(this.namespace);
    await config.update(key, value, global);
  }

  /**
   * Check if a configuration has a value
   */
  has(key: ConfigKey): boolean {
    const config = workspace.getConfiguration(this.namespace);
    return config.has(key);
  }

  /**
   * Get the underlying VS Code configuration object
   * Use sparingly - prefer typed methods above
   */
  getRawConfiguration() {
    return workspace.getConfiguration(this.namespace);
  }

  /**
   * Get configuration for a different namespace
   * Useful for accessing theme-specific configs
   */
  getConfiguration(namespace: string) {
    return workspace.getConfiguration(namespace);
  }

  /**
   * Subscribe to configuration changes for specific keys
   */
  onDidChangeConfiguration(
    key: ConfigKey,
    listener: (e: ConfigurationChangeEvent) => void
  ): Disposable {
    const disposable = this.changeEmitter.event((changedKey) => {
      if (changedKey === key) {
        listener({
          affectsConfiguration: (section: string) => {
            return section === `${this.namespace}.${key}`;
          }
        } as ConfigurationChangeEvent);
      }
    });

    this.disposables.push(disposable);
    return disposable;
  }

  /**
   * Handle configuration changes
   */
  private handleConfigurationChange(e: ConfigurationChangeEvent): void {
    // Check each known configuration key
    for (const key of Object.values(CONFIG_KEYS)) {
      if (e.affectsConfiguration(`${this.namespace}.${key}`)) {
        this.changeEmitter.fire(key);
      }
    }
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.disposables.forEach((d: Disposable) => {
      d.dispose();
    });
    this.disposables = [];
    this.changeEmitter.dispose();
  }
}

/**
 * Export singleton instance getter
 */
export const configManager = () => ConfigurationManager.getInstance();

/**
 * Convenience functions for common operations
 */
export const getConfig = <K extends ConfigKey>(key: K, defaultValue?: ConfigurationTypes[K]): ConfigurationTypes[K] => {
  // Your solution: take any from the config system, cast to expected type
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  const anyResult = configManager().get(key, defaultValue);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return anyResult;
};

export const updateConfig = async <K extends ConfigKey>(key: K, value: ConfigurationTypes[K]) => {
  return configManager().update(key, value);
};

export const hasConfig = (key: ConfigKey) => {
  return configManager().has(key);
};