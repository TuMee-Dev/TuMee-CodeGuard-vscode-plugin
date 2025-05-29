/**
 * Template loader for HTML templates in TuMee VSCode Plugin
 */

import * as fs from 'fs';
import * as path from 'path';

export interface TemplateReplacements {
  [key: string]: string | number | boolean;
}

const templateCache: Map<string, string> = new Map();

/**
 * Load an HTML template from file
 */
export function loadTemplate(templateName: string): string {
  const cacheKey = templateName;

  if (templateCache.has(cacheKey)) {
    return templateCache.get(cacheKey) || '';
  }

  try {
    // Try multiple paths to find the template
    let templatePath = path.join(__dirname, '..', 'resources', templateName);

    // If not found in the expected location, try the dist location
    if (!fs.existsSync(templatePath)) {
      templatePath = path.join(__dirname, '..', '..', 'dist', 'resources', templateName);
    }

    // If still not found, try relative to process.cwd()
    if (!fs.existsSync(templatePath)) {
      templatePath = path.join(process.cwd(), 'dist', 'resources', templateName);
    }

    const templateContent = fs.readFileSync(templatePath, 'utf8');
    templateCache.set(cacheKey, templateContent);
    return templateContent;
  } catch (error) {
    console.error(`Failed to load template ${templateName}:`, error);
    throw new Error(`Template ${templateName} not found`);
  }
}

/**
 * Replace placeholders in a template with values
 */
export function replaceTemplatePlaceholders(
  template: string,
  replacements: TemplateReplacements
): string {
  let result = template;

  for (const [key, value] of Object.entries(replacements)) {
    const placeholder = `{{${key}}}`;
    // Use global replace to handle multiple occurrences
    result = result.replace(new RegExp(placeholder, 'g'), String(value));
  }

  return result;
}

/**
 * Load and process a template with replacements
 */
export function processTemplate(
  templateName: string,
  replacements: TemplateReplacements
): string {
  const template = loadTemplate(templateName);
  return replaceTemplatePlaceholders(template, replacements);
}

/**
 * Clear template cache (useful for development/testing)
 */
export function clearTemplateCache(): void {
  templateCache.clear();
}