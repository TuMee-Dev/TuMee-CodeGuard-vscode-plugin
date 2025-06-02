import { promisify } from 'util';
import { exec as execCallback } from 'child_process';
import { Uri, workspace } from 'vscode';
import type { ACLStatus } from '@/types';
import { cleanPath } from '../core';
// Removed local parsing - CLI only
import { GUARD_TAG_PATTERNS, normalizePermission, normalizeScope } from '../cache/regexCache';
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
 * Delegates to core module for platform-agnostic parsing
 */
// parseGuardTag removed - CLI only

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