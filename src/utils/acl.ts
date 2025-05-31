import { promisify } from 'util';
import { exec as execCallback } from 'child_process';
import { Uri, workspace } from 'vscode';
import type { ACLStatus } from '@/types';
import { cleanPath } from '.';
import { GUARD_TAG_PATTERNS, normalizePermission, normalizeScope } from './regexCache';
import { getConfig, CONFIG_KEYS } from './configurationManager';

const exec = promisify(execCallback);

let lastCliAvailableCheck: boolean | null = null;
let lastCliCheckTime = 0;
const CLI_CHECK_CACHE_TIME = 5000; // Cache CLI availability check for 5 seconds

/**
 * Gets the configured path to the ACL CLI tool
 */
export const getAclCliPath = (): string => {
  return getConfig(CONFIG_KEYS.ACL_CLI_PATH, 'codeguard');
};

/**
 * Checks if the CodeGuard CLI is available
 * @returns true if CLI is available, false otherwise
 */
export const isCliAvailable = async (): Promise<boolean> => {
  // Use cached result if recent
  const now = Date.now();
  if (lastCliAvailableCheck !== null && (now - lastCliCheckTime) < CLI_CHECK_CACHE_TIME) {
    return lastCliAvailableCheck;
  }

  try {
    const cliPath = getAclCliPath();
    await exec(`which ${cliPath}`);
    lastCliAvailableCheck = true;
    lastCliCheckTime = now;
    return true;
  } catch {
    lastCliAvailableCheck = false;
    lastCliCheckTime = now;
    return false;
  }
};

/**
 * Regular expressions for parsing guard tags in code
 * Single source of truth from regexCache.ts
 */
export const GUARD_TAG_REGEX = GUARD_TAG_PATTERNS.GUARD_TAG;
export const MARKDOWN_GUARD_TAG_REGEX = GUARD_TAG_PATTERNS.MARKDOWN_GUARD_TAG;

/**
 * Helper function to parse a guard tag from a line of text
 * Returns the parsed guard tag information supporting ALL specification formats
 * Uses single source of truth from regexCache.ts
 */
export const parseGuardTag = (line: string): {
  identifier?: string,
  scope?: string,
  lineCount?: number,
  addScopes?: string[],
  removeScopes?: string[],
  type: string,
  aiPermission?: string,
  humanPermission?: string,
  aiIsContext?: boolean,
  humanIsContext?: boolean,
  allPermission?: string,
  allIsContext?: boolean,
  metadata?: string,
  conditional?: string
} | null => {
  // Track found permissions for each target
  let aiPermission: string | undefined;
  let humanPermission: string | undefined;
  let allPermission: string | undefined;
  let aiIsContext = false;
  let humanIsContext = false;
  let allIsContext = false;
  let identifier: string | undefined;
  let scope: string | undefined;
  let lineCount: number | undefined;
  let metadata: string | undefined;
  let conditional: string | undefined;
  const addScopes: string[] = [];
  const removeScopes: string[] = [];

  // Use comprehensive pattern to find all matches in the line
  const comprehensiveRegex = new RegExp(GUARD_TAG_PATTERNS.PARSE_GUARD_TAG.source, 'gi');
  let match;

  while ((match = comprehensiveRegex.exec(line)) !== null) {
    // Updated capture groups for comprehensive pattern:
    // [1] = primary target (ai|human|hu|all)
    // [2] = secondary target (if comma-separated)
    // [3] = identifier [...]
    // [4] = permission (read-only|readonly|read|write|noaccess|none|context|r|w|n)
    // [5] = context modifier (:r|:w|:read|:write)
    // [6] = metadata [...]
    // [7] = scope (.word or .number)
    // [8] = conditional (.if(condition))
    // [9] = add scopes (+scope)
    // [10] = remove scopes (-scope)
    const [, primaryTarget, secondaryTarget, id, permission, contextModifier, metadataCapture, scopeOrCount, conditionalCapture, addScopesStr, removeScopesStr] = match;

    // Handle targets - support multi-target syntax
    const targets = [primaryTarget];
    if (secondaryTarget) {
      targets.push(secondaryTarget);
    }

    // Check if scope is numeric (line count) or semantic
    const isLineCount = scopeOrCount && GUARD_TAG_PATTERNS.NUMERIC_SCOPE.test(scopeOrCount);

    // Normalize permission using alias mapping
    let normalizedPermission = normalizePermission(permission);

    // Handle context modifier for context permissions
    if (normalizedPermission === 'context' && contextModifier) {
      const modifierNormalized = normalizePermission(contextModifier.substring(1)); // Remove ':'
      if (modifierNormalized === 'w') {
        normalizedPermission = 'contextWrite';
      }
      // For 'r' or 'read', keep as 'context' (read context)
    }

    // Set identifier (use first found)
    if (id && !identifier) {
      identifier = id;
    }

    // Set metadata (use first found)
    if (metadataCapture && !metadata) {
      metadata = metadataCapture;
    }

    // Set conditional (use first found)
    if (conditionalCapture && !conditional) {
      conditional = conditionalCapture;
    }

    // Set scope/lineCount (use first found)
    if (isLineCount && !lineCount) {
      lineCount = parseInt(scopeOrCount, 10);
    } else if (!isLineCount && scopeOrCount && !scope) {
      scope = normalizeScope(scopeOrCount);
    }

    // Merge add/remove scopes
    if (addScopesStr) {
      addScopes.push(...addScopesStr.split('+').filter(s => s).map(s => normalizeScope(s)));
    }
    if (removeScopesStr) {
      removeScopes.push(...removeScopesStr.split('-').filter(s => s).map(s => normalizeScope(s)));
    }

    // Store permission by target(s)
    for (const target of targets) {
      const normalizedTarget = target.toLowerCase() === 'hu' ? 'human' : target.toLowerCase();
      
      if (normalizedTarget === 'ai') {
        if (normalizedPermission === 'context') {
          aiIsContext = true;
        } else if (normalizedPermission === 'contextWrite') {
          aiPermission = 'contextWrite';
        } else {
          aiPermission = normalizedPermission;
        }
      } else if (normalizedTarget === 'human') {
        if (normalizedPermission === 'context') {
          humanIsContext = true;
        } else if (normalizedPermission === 'contextWrite') {
          humanPermission = 'contextWrite';
        } else {
          humanPermission = normalizedPermission;
        }
      } else if (normalizedTarget === 'all') {
        if (normalizedPermission === 'context') {
          allIsContext = true;
        } else if (normalizedPermission === 'contextWrite') {
          allPermission = 'contextWrite';
        } else {
          allPermission = normalizedPermission;
        }
      }
    }
  }

  // If we found any permissions or context flags, return them
  if (aiPermission || humanPermission || allPermission || aiIsContext || humanIsContext || allIsContext) {
    return {
      identifier,
      scope,
      lineCount,
      addScopes: addScopes.length > 0 ? [...new Set(addScopes)] : undefined,
      removeScopes: removeScopes.length > 0 ? [...new Set(removeScopes)] : undefined,
      type: 'comprehensive',
      aiPermission,
      humanPermission,
      allPermission,
      aiIsContext,
      humanIsContext,
      allIsContext,
      metadata,
      conditional
    };
  }

  // No valid guard tags found
  return null;
};

/**
 * Executes the CodeGuard CLI to get the ACL status for a given path
 * @param path The path to check ACL status for
 * @returns A promise that resolves to the ACL status
 */
export const getAclStatus = async (path: string): Promise<ACLStatus | null> => {
  const cleanedPath = cleanPath(path);

  try {
    const cliPath = getAclCliPath();

    // Check if CodeGuard CLI is available
    try {
      await exec(`which ${cliPath}`);
    } catch {
      console.warn(`CodeGuard CLI not found at: ${cliPath}. Returning null.`);
      // Return null when CLI is not available - no coloring should happen
      return null;
    }

    // Execute with timeout to handle slow CLI startup
    const { stdout } = await exec(`${cliPath} acl "${cleanedPath}" -f json`, {
      timeout: 10000 // 10 seconds timeout for slow startup
    });

    try {
      return JSON.parse(stdout) as ACLStatus;
    } catch (e) {
      console.error(`Error parsing ACL status: ${String(e)}`);
      return null;
    }
  } catch (error) {
    console.error(`Error getting ACL status: ${error instanceof Error ? error.message : String(error)}`);
    // Return null on error - no coloring should happen
    return null;
  }
};

/**
 * Sets the ACL status for a given path
 * @param path The path to set ACL status for
 * @param who Who the rule applies to ('AI', 'HU', or 'ALL')
 * @param permission The permission level ('RO', 'ED', 'FX')
 * @returns A promise that resolves to true if successful
 */
export const setAclStatus = async (path: string, who: string, permission: string): Promise<boolean> => {
  try {
    const cliPath = getAclCliPath();
    const cleanedPath = cleanPath(path);

    // Check if CodeGuard CLI is available
    try {
      await exec(`which ${cliPath}`);
    } catch {
      console.warn(`CodeGuard CLI not found at: ${cliPath}. ACL update skipped.`);
      // Return true to avoid breaking the workflow when CLI is not available
      return true;
    }

    try {
      // Determine if this is a file or directory to use the right command
      const fileStat = await workspace.fs.stat(Uri.file(cleanedPath));
      const isDirectory = (fileStat.type & 1) === 1; // FileType.Directory === 1
      let command: string;

      if (isDirectory) {
        // Create or modify .ai-attributes file
        command = `${cliPath} create-aiattributes --directory "${cleanedPath}" --rule "* @guard:${who.toLowerCase()}:${permission.toLowerCase()}"`;
      } else {
        // Set in-file annotation by modifying the file
        command = `${cliPath} set-guard --file "${cleanedPath}" --rule "@guard:${who.toLowerCase()}:${permission.toLowerCase()}"`;
      }

      await exec(command);
      return true;
    } catch (error) {
      console.error(`Error getting file stat or setting ACL: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  } catch (error) {
    console.error(`Error in setAclStatus: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
};

/**
 * Clears the ACL status for a given path
 * @param path The path to clear ACL status for
 * @returns A promise that resolves to true if successful
 */
export const clearAclStatus = async (path: string): Promise<boolean> => {
  try {
    const cliPath = getAclCliPath();
    const cleanedPath = cleanPath(path);

    try {
      const fileStat = await workspace.fs.stat(Uri.file(cleanedPath));
      const isDirectory = (fileStat.type & 1) === 1; // FileType.Directory === 1
      let command: string;

      if (isDirectory) {
        // Remove .ai-attributes file or clear its contents
        command = `${cliPath} remove-aiattributes --directory "${cleanedPath}"`;
      } else {
        // Remove in-file annotation
        command = `${cliPath} remove-guard --file "${cleanedPath}"`;
      }

      await exec(command);
      return true;
    } catch (error) {
      console.error(`Error getting file stat or clearing ACL: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  } catch (error) {
    console.error(`Error in clearAclStatus: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
};