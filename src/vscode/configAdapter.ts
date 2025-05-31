/**
 * VSCode configuration adapter for core module
 */

import type { ICoreConfiguration } from '../core';

/**
 * Configuration interface adapter
 */
export interface IConfiguration {
  get<T>(key: string, defaultValue: T): T;
}

/**
 * Adapts VSCode configuration to core configuration interface
 */
export class VSCodeConfigurationAdapter implements ICoreConfiguration {
  constructor(private config: IConfiguration) {}

  get<T>(key: string, defaultValue: T): T {
    return this.config.get(key, defaultValue);
  }
}