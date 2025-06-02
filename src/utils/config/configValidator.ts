import type { ConfigurationChangeEvent } from 'vscode';
import { window } from 'vscode';
import { getExtensionWithOptionalName } from '../core/index';
import { errorHandler } from '../error/errorHandler';
import { configManager } from './configurationManager';

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface ConfigurationRules {
  [key: string]: {
    type: 'number' | 'string' | 'boolean' | 'object' | 'array';
    min?: number;
    max?: number;
    pattern?: RegExp;
    required?: boolean;
    validator?: (value: unknown) => ValidationResult;
  };
}

const CONFIG_RULES: ConfigurationRules = {
  'decorationUpdateDelay': {
    type: 'number',
    min: 100,
    max: 1000,
    required: false
  },
  'maxFileSize': {
    type: 'number',
    min: 100000,
    max: 10000000,
    required: false
  },
  'enableChunkedProcessing': {
    type: 'boolean',
    required: false
  },
  'chunkSize': {
    type: 'number',
    min: 100,
    max: 5000,
    required: false
  },
  'enableIncrementalParsing': {
    type: 'boolean',
    required: false
  },
  'enablePerformanceMonitoring': {
    type: 'boolean',
    required: false
  },
  'aclCliPath': {
    type: 'string',
    required: false,
    validator: (value: unknown) => {
      const result: ValidationResult = { valid: true, errors: [], warnings: [] };
      const pathValue = value as string;

      // Check if it's a valid path format
      if (pathValue && pathValue.includes(' ') && !pathValue.startsWith('"')) {
        result.warnings.push('Path contains spaces but is not quoted. This may cause issues.');
      }

      // Check for common misconfigurations
      if (pathValue === 'codeguard' || pathValue === './codeguard') {
        // This is fine - using PATH or relative path
      } else if (pathValue && pathValue.startsWith('~')) {
        result.warnings.push('Path starts with ~. Make sure your shell expands this properly.');
      }

      return result;
    }
  },
  'codeDecorationOpacity': {
    type: 'number',
    min: 0,
    max: 1,
    required: false
  },
  'colorChangedFiles': {
    type: 'boolean',
    required: false
  },
  'guardColors': {
    type: 'object',
    required: false,
    validator: (value: unknown) => {
      const result: ValidationResult = { valid: true, errors: [], warnings: [] };

      if (!value || typeof value !== 'object') {
        return result;
      }

      const validColors = [
        // Base colors
        'aiWrite', 'aiRead', 'aiNoAccess',
        'humanWrite', 'humanRead', 'humanNoAccess',
        'contextRead', 'contextWrite',
        'opacity',
        // Transparency configuration
        'aiTransparencyLevels', 'humanTransparencyLevels', 'useAiColorAsBase',
        // Legacy compatibility
        'humanReadOnly', 'context',
        // Permission combinations
        'aiRead_humanRead', 'aiRead_humanWrite', 'aiRead_humanNoAccess',
        'aiWrite_humanRead', 'aiWrite_humanWrite', 'aiWrite_humanNoAccess',
        'aiNoAccess_humanRead', 'aiNoAccess_humanWrite', 'aiNoAccess_humanNoAccess',
        // Context variants
        'aiReadContext_humanRead', 'aiReadContext_humanWrite', 'aiReadContext_humanNoAccess',
        'aiWriteContext_humanRead', 'aiWriteContext_humanWrite', 'aiWriteContext_humanNoAccess'
      ];
      const colorPattern = /^#[0-9A-Fa-f]{6}$/;

      const valueObj = value as Record<string, unknown>;
      for (const key of Object.keys(valueObj)) {
        if (!validColors.includes(key)) {
          result.warnings.push(`Unknown guard color key: ${key}`);
          continue;
        }

        if (key === 'opacity') {
          const opacity = valueObj[key] as number;
          if (typeof opacity !== 'number' || opacity < 0 || opacity > 1) {
            result.errors.push('Guard color opacity must be between 0 and 1');
          }
        } else if (key === 'aiTransparencyLevels' || key === 'humanTransparencyLevels') {
          const levels = valueObj[key] as Record<string, number>;
          if (typeof levels !== 'object') {
            result.errors.push(`${key} must be an object`);
          } else {
            for (const level of ['write', 'read', 'noAccess']) {
              if (levels[level] !== undefined) {
                if (typeof levels[level] !== 'number' || levels[level] < 0 || levels[level] > 1) {
                  result.errors.push(`${key}.${level} must be between 0 and 1`);
                }
              }
            }
          }
        } else if (key === 'useAiColorAsBase') {
          if (typeof valueObj[key] !== 'boolean') {
            result.errors.push('useAiColorAsBase must be a boolean');
          }
        } else {
          const color = valueObj[key] as string;
          if (typeof color !== 'string' || !colorPattern.test(color)) {
            result.errors.push(`Invalid color format for ${key}: ${color}. Use hex format like #FF0000`);
          }
        }
      }

      return result;
    }
  },
  'items': {
    type: 'array',
    required: false,
    validator: (value: unknown) => {
      const result: ValidationResult = { valid: true, errors: [], warnings: [] };

      if (!Array.isArray(value)) {
        return result;
      }

      const items = value as Array<Record<string, unknown>>;
      items.forEach((item, index) => {
        if (!item.path) {
          result.errors.push(`Item at index ${index} is missing required 'path' property`);
        }

        const itemType = item.type as string;
        if (itemType && !['file', 'folder', 'any'].includes(itemType)) {
          result.errors.push(`Item at index ${index} has invalid type: ${itemType}`);
        }

        const badge = item.badge as string;
        if (badge && typeof badge === 'string' && badge.length > 2) {
          result.warnings.push(`Item at index ${index} has badge longer than 2 characters. It will be truncated.`);
        }

        const color = item.color as string;
        if (color && typeof color === 'string') {
          // Validate color format
          if (!color.startsWith('tumee.') && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
            result.warnings.push(`Item at index ${index} has non-standard color format: ${color}`);
          }
        }
      });

      return result;
    }
  }
};

export class ConfigValidator {
  private lastValidationTime = 0;
  private validationInterval = 5000; // Don't validate more than once per 5 seconds

  /**
   * Validate all configuration settings
   */
  validateConfiguration(): ValidationResult {
    const now = Date.now();
    if (now - this.lastValidationTime < this.validationInterval) {
      return { valid: true, errors: [], warnings: [] };
    }

    this.lastValidationTime = now;
    const result: ValidationResult = { valid: true, errors: [], warnings: [] };
    const cm = configManager();

    for (const [key, rules] of Object.entries(CONFIG_RULES)) {
      const value = cm.get(key as any);

      // Check if required
      if (rules.required && (value === undefined || value === null)) {
        result.errors.push(`Missing required configuration: ${key}`);
        result.valid = false;
        continue;
      }

      // Skip if not set and not required
      if (value === undefined || value === null) {
        continue;
      }

      // Check type
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (actualType !== rules.type) {
        result.errors.push(`Configuration ${key} should be ${rules.type} but is ${actualType}`);
        result.valid = false;
        continue;
      }

      // Check numeric bounds
      if (rules.type === 'number' && typeof value === 'number') {
        if (rules.min !== undefined && value < rules.min) {
          result.errors.push(`Configuration ${key} (${value}) is below minimum ${rules.min}`);
          result.valid = false;
        }
        if (rules.max !== undefined && value > rules.max) {
          result.errors.push(`Configuration ${key} (${value}) is above maximum ${rules.max}`);
          result.valid = false;
        }
      }

      // Check pattern
      if (rules.pattern && typeof value === 'string' && !rules.pattern.test(value)) {
        result.errors.push(`Configuration ${key} does not match required pattern`);
        result.valid = false;
      }

      // Run custom validator
      if (rules.validator) {
        const validatorResult = rules.validator(value);
        result.errors.push(...validatorResult.errors);
        result.warnings.push(...validatorResult.warnings);
        if (validatorResult.errors.length > 0) {
          result.valid = false;
        }
      }
    }

    return result;
  }

  /**
   * Show validation errors to user
   */
  showValidationErrors(result: ValidationResult): void {
    if (result.errors.length > 0) {
      const message = `Configuration errors:\n${  result.errors.join('\n')}`;
      void window.showErrorMessage(message);
      errorHandler.handleError(new Error(message), {
        operation: 'configValidation',
        userFriendlyMessage: message
      });
    }

    if (result.warnings.length > 0 && result.errors.length === 0) {
      const message = `Configuration warnings:\n${  result.warnings.join('\n')}`;
      errorHandler.showWarning(message);
    }
  }

  /**
   * Validate configuration on change
   */
  handleConfigurationChange(event: ConfigurationChangeEvent): void {
    if (event.affectsConfiguration(getExtensionWithOptionalName())) {
      const result = this.validateConfiguration();
      if (!result.valid || result.warnings.length > 0) {
        this.showValidationErrors(result);
      }
    }
  }

  /**
   * Auto-fix common configuration issues
   */
  async autoFixConfiguration(): Promise<void> {
    const cm = configManager();
    let changed = false;

    // Fix opacity values out of range
    const opacity = cm.get('codeDecorationOpacity' as any, 0.1) as number;
    if (opacity !== undefined && (opacity < 0 || opacity > 1)) {
      await cm.update('codeDecorationOpacity' as any, Math.max(0, Math.min(1, opacity)));
      changed = true;
    }

    // Fix guard colors opacity
    const guardColors = cm.get('guardColors' as any) as Record<string, unknown> | undefined;
    if (guardColors && guardColors.opacity !== undefined) {
      const opacity = guardColors.opacity as number;
      if (opacity < 0 || opacity > 1) {
        guardColors.opacity = Math.max(0, Math.min(1, opacity));
        await cm.update('guardColors' as any, guardColors);
        changed = true;
      }
    }

    // Fix numeric values out of range
    const decorationDelay = cm.get('decorationUpdateDelay' as any, 300) as number;
    if (decorationDelay !== undefined && (decorationDelay < 100 || decorationDelay > 1000)) {
      await cm.update('decorationUpdateDelay' as any, Math.max(100, Math.min(1000, decorationDelay)));
      changed = true;
    }

    if (changed) {
      void window.showInformationMessage('Some configuration values were automatically adjusted to valid ranges.');
    }
  }
}

// Singleton instance
export const configValidator = new ConfigValidator();