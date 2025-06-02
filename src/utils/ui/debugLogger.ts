import { configManager, CONFIG_KEYS } from '../config/configurationManager';

/**
 * Debug logger that only logs when debug logging is enabled
 */
export class DebugLogger {
  private static isEnabled(): boolean {
    const cm = configManager();
    return cm.get(CONFIG_KEYS.ENABLE_DEBUG_LOGGING, false);
  }

  static log(...args: unknown[]): void {
    if (this.isEnabled()) {
      console.log(...args); // eslint-disable-line no-console
    }
  }

  static warn(...args: unknown[]): void {
    if (this.isEnabled()) {
      console.warn(...args); // eslint-disable-line no-console
    }
  }

  static error(...args: unknown[]): void {
    if (this.isEnabled()) {
      console.error(...args); // eslint-disable-line no-console
    }
  }
}