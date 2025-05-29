/**
 * Template loader for HTML templates in TuMee VSCode Plugin
 */

import * as fs from 'fs';
import * as path from 'path';
import { withErrorRethrow } from './errorWrapper';

export interface TemplateReplacements {
  [key: string]: string | number | boolean;
}

const templateCache: Map<string, string> = new Map();

/**
 * Load an HTML template from file
 */
export async function loadTemplate(templateName: string): Promise<string> {
  const cacheKey = templateName;

  if (templateCache.has(cacheKey)) {
    return templateCache.get(cacheKey) || '';
  }

  return withErrorRethrow(
    async () => {
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
    },
    `Failed to load template ${templateName}`,
    `Template ${templateName} not found`
  );
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
export async function processTemplate(
  templateName: string,
  replacements: TemplateReplacements
): Promise<string> {
  const template = await loadTemplate(templateName);
  return replaceTemplatePlaceholders(template, replacements);
}

/**
 * Clear template cache (useful for development/testing)
 */
export function clearTemplateCache(): void {
  templateCache.clear();
}