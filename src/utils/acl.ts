import { promisify } from 'util';
import { exec as execCallback } from 'child_process';
import { Uri, workspace } from 'vscode';
import type { ACLStatus } from '@/types';
import { cleanPath, getExtensionWithOptionalName } from '.';
import { GUARD_TAG_PATTERNS } from './regexCache';

const exec = promisify(execCallback);

let lastCliAvailableCheck: boolean | null = null;
let lastCliCheckTime = 0;
const CLI_CHECK_CACHE_TIME = 5000; // Cache CLI availability check for 5 seconds

/**
 * Gets the configured path to the ACL CLI tool
 */
export const getAclCliPath = (): string => {
  return workspace.getConfiguration(getExtensionWithOptionalName()).get<string>('aclCliPath') || 'codeguard';
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
 * These are now imported from regexCache.ts for better performance
 */
export const GUARD_TAG_REGEX = GUARD_TAG_PATTERNS.GUARD_TAG;
export const MARKDOWN_GUARD_TAG_REGEX = GUARD_TAG_PATTERNS.MARKDOWN_GUARD_TAG;
export const LEGACY_GUARD_TAG_REGEX = GUARD_TAG_PATTERNS.LEGACY_GUARD_TAG;
export const GUARD_TAG_NO_SPACE_REGEX = GUARD_TAG_PATTERNS.GUARD_TAG_NO_SPACE;
export const GUARD_TAG_LINE_REGEX = GUARD_TAG_PATTERNS.GUARD_TAG_LINE;
export const LINE_COUNT_REGEX = GUARD_TAG_PATTERNS.LINE_COUNT;
export const PYTHON_LINE_COUNT_REGEX = GUARD_TAG_PATTERNS.PYTHON_LINE_COUNT;
export const JAVASCRIPT_LINE_COUNT_REGEX = GUARD_TAG_PATTERNS.JAVASCRIPT_LINE_COUNT;

/**
 * Helper function to parse a guard tag from a line of text
 * Returns the parsed guard tag information
 * If multiple tags exist, they are merged into a single combined state
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
  humanIsContext?: boolean
} | null => {
  // Track found permissions for each target
  let aiPermission: string | undefined;
  let humanPermission: string | undefined;
  let aiIsContext = false;
  let humanIsContext = false;
  let identifier: string | undefined;
  let scope: string | undefined;
  let lineCount: number | undefined;
  const addScopes: string[] = [];
  const removeScopes: string[] = [];

  // Use global flag to find all matches in the line
  const newFormatRegex = new RegExp(GUARD_TAG_PATTERNS.PARSE_GUARD_TAG.source, 'g');
  let match;

  while ((match = newFormatRegex.exec(line)) !== null) {
    const [, target, id, permission, scopeOrCount, addScopesStr, removeScopesStr] = match;

    // Check if scope is numeric (line count) or semantic
    const isLineCount = scopeOrCount && GUARD_TAG_PATTERNS.NUMERIC_SCOPE.test(scopeOrCount);

    // Normalize target: 'hu' -> 'human'
    const normalizedTarget = target.toLowerCase() === 'hu' ? 'human' : target.toLowerCase();

    // Normalize permission: 'read' -> 'r', 'write' -> 'w', 'noaccess' -> 'n'
    let normalizedPermission = permission.toLowerCase();
    if (normalizedPermission === 'read') normalizedPermission = 'r';
    else if (normalizedPermission === 'write') normalizedPermission = 'w';
    else if (normalizedPermission === 'noaccess') normalizedPermission = 'n';

    // Set identifier (use first found)
    if (id && !identifier) {
      identifier = id;
    }

    // Set scope/lineCount (use first found)
    if (isLineCount && !lineCount) {
      lineCount = parseInt(scopeOrCount, 10);
    } else if (!isLineCount && scopeOrCount && !scope) {
      scope = scopeOrCount;
    }

    // Merge add/remove scopes
    if (addScopesStr) {
      addScopes.push(...addScopesStr.split('+').filter(s => s));
    }
    if (removeScopesStr) {
      removeScopes.push(...removeScopesStr.split('-').filter(s => s));
    }

    // Store permission by target
    if (normalizedTarget === 'ai') {
      if (normalizedPermission === 'context') {
        aiIsContext = true;
        // For context, we need to set a permission (will be inherited from current state)
        // Set to undefined here - the processor will use the current permission
        aiPermission = undefined;
      } else {
        aiPermission = normalizedPermission;
        aiIsContext = false;
      }
    } else if (normalizedTarget === 'human') {
      if (normalizedPermission === 'context') {
        humanIsContext = true;
        // For context, we need to set a permission (will be inherited from current state)
        // Set to undefined here - the processor will use the current permission
        humanPermission = undefined;
      } else {
        humanPermission = normalizedPermission;
        humanIsContext = false;
      }
    }
  }

  // If we found any permissions or context flags from new format tags, return them
  if (aiPermission || humanPermission || aiIsContext || humanIsContext) {
    return {
      identifier,
      scope,
      lineCount,
      addScopes: addScopes.length > 0 ? [...new Set(addScopes)] : undefined,
      removeScopes: removeScopes.length > 0 ? [...new Set(removeScopes)] : undefined,
      type: 'new-format',
      aiPermission,
      humanPermission,
      aiIsContext,
      humanIsContext
    };
  }

  // Try legacy formats if no new format tags found
  const legacyMatch = line.match(GUARD_TAG_PATTERNS.PARSE_LEGACY_GUARD_TAG);
  if (legacyMatch) {
    // Normalize permission for legacy format too
    let normalizedPermission = legacyMatch[1].toLowerCase();
    if (normalizedPermission === 'read') normalizedPermission = 'r';
    else if (normalizedPermission === 'write') normalizedPermission = 'w';
    else if (normalizedPermission === 'noaccess') normalizedPermission = 'n';

    return {
      lineCount: legacyMatch[2] ? parseInt(legacyMatch[2], 10) : undefined,
      type: 'legacy',
      aiPermission: normalizedPermission === 'context' ? undefined : normalizedPermission,
      aiIsContext: normalizedPermission === 'context'
    };
  }

  // Try Python-specific pattern (legacy)
  const pythonMatch = line.match(PYTHON_LINE_COUNT_REGEX);
  if (pythonMatch) {
    let normalizedPermission = pythonMatch[1].toLowerCase();
    if (normalizedPermission === 'read') normalizedPermission = 'r';
    else if (normalizedPermission === 'write') normalizedPermission = 'w';
    else if (normalizedPermission === 'noaccess') normalizedPermission = 'n';

    return {
      lineCount: parseInt(pythonMatch[2], 10),
      type: 'python',
      aiPermission: normalizedPermission === 'context' ? undefined : normalizedPermission,
      aiIsContext: normalizedPermission === 'context'
    };
  }

  // Try JavaScript-specific pattern (legacy)
  const jsMatch = line.match(JAVASCRIPT_LINE_COUNT_REGEX);
  if (jsMatch) {
    let normalizedPermission = jsMatch[1].toLowerCase();
    if (normalizedPermission === 'read') normalizedPermission = 'r';
    else if (normalizedPermission === 'write') normalizedPermission = 'w';
    else if (normalizedPermission === 'noaccess') normalizedPermission = 'n';

    return {
      lineCount: parseInt(jsMatch[2], 10),
      type: 'javascript',
      aiPermission: normalizedPermission === 'context' ? undefined : normalizedPermission,
      aiIsContext: normalizedPermission === 'context'
    };
  }

  // If no match, return null
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
        command = `${cliPath} create-aiattributes --directory "${cleanedPath}" --rule "* @GUARD:${who}-${permission}"`;
      } else {
        // Set in-file annotation by modifying the file
        command = `${cliPath} set-guard --file "${cleanedPath}" --rule "@GUARD:${who}-${permission}"`;
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