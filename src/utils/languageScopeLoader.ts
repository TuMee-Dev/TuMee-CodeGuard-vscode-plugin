/**
 * Loader for language scope configuration from external JSON file
 */

import * as fs from 'fs';
import * as path from 'path';

export interface LanguageScopes {
  scopes: Record<string, string[]>;
  extends?: string;
}

export interface LanguageScopeConfig {
  version: string;
  commonPatterns?: Record<string, string[]>;
  languages: Record<string, LanguageScopes>;
}

let cachedConfig: LanguageScopeConfig | null = null;
let resolvedScopes: Record<string, Record<string, string[]>> | null = null;

/**
 * Load language scope configuration from JSON file
 */
export function loadLanguageScopes(): LanguageScopeConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  try {
    // In production, __dirname is dist/utils, so we need to go up one level
    // In development, it might be src/utils
    let configPath = path.join(__dirname, '..', 'resources', 'language-scopes.json');

    // If not found in the expected location, try the dist location
    if (!fs.existsSync(configPath)) {
      configPath = path.join(__dirname, '..', '..', 'dist', 'resources', 'language-scopes.json');
    }

    // If still not found, try relative to process.cwd() for CLI usage
    if (!fs.existsSync(configPath)) {
      configPath = path.join(process.cwd(), 'dist', 'resources', 'language-scopes.json');
    }

    const configData = fs.readFileSync(configPath, 'utf8');
    cachedConfig = JSON.parse(configData) as LanguageScopeConfig;
    return cachedConfig;
  } catch (error) {
    console.error('Failed to load language scopes configuration:', error);
    // Return minimal fallback configuration
    return {
      version: '1.0.0',
      languages: {}
    };
  }
}

/**
 * Resolve language scopes with inheritance
 */
function resolveLanguageScopes(config: LanguageScopeConfig): Record<string, Record<string, string[]>> {
  const resolved: Record<string, Record<string, string[]>> = {};

  // Helper to resolve a single language
  function resolveLanguage(langId: string, visited: Set<string> = new Set()): Record<string, string[]> {
    // Prevent circular dependencies
    if (visited.has(langId)) {
      console.warn(`Circular dependency detected for language: ${langId}`);
      return {};
    }

    visited.add(langId);

    const lang = config.languages[langId];
    if (!lang) {
      return {};
    }

    const scopes: Record<string, string[]> = {};

    // If this language extends another, get the parent scopes first
    if (lang.extends) {
      const parentScopes = resolveLanguage(lang.extends, visited);
      // Deep copy parent scopes
      for (const key in parentScopes) {
        scopes[key] = [...parentScopes[key]];
      }
    }

    // Apply this language's scopes (merge with parent)
    if (lang.scopes) {
      for (const key in lang.scopes) {
        if (scopes[key]) {
          // Merge with parent scope
          scopes[key] = [...scopes[key], ...lang.scopes[key]];
        } else {
          // New scope
          scopes[key] = [...lang.scopes[key]];
        }
      }
    }

    return scopes;
  }

  // Resolve all languages
  for (const langId in config.languages) {
    resolved[langId] = resolveLanguage(langId);
  }

  return resolved;
}

/**
 * Get scope mappings for all languages
 */
export function getScopeMappings(): Record<string, Record<string, string[]>> {
  if (resolvedScopes) {
    return resolvedScopes;
  }

  const config = loadLanguageScopes();
  resolvedScopes = resolveLanguageScopes(config);
  return resolvedScopes;
}

/**
 * Get scope mappings for a specific language
 */
export function getLanguageScopeMappings(languageId: string): Record<string, string[]> | undefined {
  const mappings = getScopeMappings();
  return mappings[languageId];
}

/**
 * Clear cached configurations (useful for testing or hot reload)
 */
export function clearCache(): void {
  cachedConfig = null;
  resolvedScopes = null;
}