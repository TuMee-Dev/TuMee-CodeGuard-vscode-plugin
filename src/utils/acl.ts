import { promisify } from "util";
import { exec as execCallback } from "child_process";
import { Uri, workspace } from "vscode";
import type { ACLStatus } from "@/types";
import { cleanPath, getExtensionWithOptionalName } from ".";

const exec = promisify(execCallback);

/**
 * Gets the configured path to the ACL CLI tool
 */
export const getAclCliPath = (): string => {
  return workspace.getConfiguration(getExtensionWithOptionalName()).get<string>("aclCliPath") || "codeguard";
};

/**
 * Regular expressions for parsing guard tags in code
 * The format is @guard:ai:permission[.count] where permission can be r (read), w (write), or n (none)
 * and count is an optional number of lines this guard applies to.
 * This may be preceded by language-specific comment characters (e.g., //, #, --, *)
 */
export const GUARD_TAG_REGEX = /(?:\/\/|#|--|\/\*|\*)*\s*@guard:ai:(r|w|n)(?:\.(\d+))?/gi;
export const GUARD_TAG_NO_SPACE_REGEX = /(?:\/\/|#|--|\*)\s*@guard:ai:(r|w|n)(?:\.(\d+))?/gi;
export const GUARD_TAG_LINE_REGEX = /.*@guard:ai:(r|w|n)(?:\.(\d+))?.*/gi;

/**
 * Special regex for detecting guard tags with line counts.
 * These patterns are more strict and will match only when a line count is present.
 */
export const LINE_COUNT_REGEX = /(?:\/\/|#|--|\/\*|\*)*\s*@guard:ai:(r|w|n)\.(\d+)/i;
export const PYTHON_LINE_COUNT_REGEX = /#\s*@guard:ai:(r|w|n)\.(\d+)/i;
export const JAVASCRIPT_LINE_COUNT_REGEX = /\/\/\s*@guard:ai:(r|w|n)\.(\d+)/i;

/**
 * Helper function to parse a guard tag from a line of text
 * Returns the permission (r, w, n) and line count if present
 */
export const parseGuardTag = (line: string): { permission: string, lineCount?: number, type: string } | null => {
  // First try the Python-specific pattern
  const pythonMatch = line.match(PYTHON_LINE_COUNT_REGEX);
  if (pythonMatch) {
    return {
      permission: pythonMatch[1].toLowerCase(),
      lineCount: parseInt(pythonMatch[2], 10),
      type: 'python'
    };
  }

  // Then try the JavaScript-specific pattern
  const jsMatch = line.match(JAVASCRIPT_LINE_COUNT_REGEX);
  if (jsMatch) {
    return {
      permission: jsMatch[1].toLowerCase(),
      lineCount: parseInt(jsMatch[2], 10),
      type: 'javascript'
    };
  }

  // Then try the generic line count pattern
  const lineCountMatch = line.match(LINE_COUNT_REGEX);
  if (lineCountMatch) {
    return {
      permission: lineCountMatch[1].toLowerCase(),
      lineCount: parseInt(lineCountMatch[2], 10),
      type: 'generic'
    };
  }

  // Finally try the regular guard tag pattern
  const guardTagMatch = line.match(/(?:\/\/|#|--|\/\*|\*)*\s*@guard:ai:(r|w|n)(?:\.(\d+))?/i);
  if (guardTagMatch) {
    return {
      permission: guardTagMatch[1].toLowerCase(),
      lineCount: guardTagMatch[2] ? parseInt(guardTagMatch[2], 10) : undefined,
      type: 'regular'
    };
  }

  // If no match, return null
  return null;
};

/**
 * Special regex for markdown files - only matches guard tags inside HTML comments
 * The comment must begin with <!-- and can contain the guard tag
 * Line count is captured in the second capture group
 */
export const MARKDOWN_GUARD_TAG_REGEX = /<!--.*?@guard:ai:(r|w|n)(\.(\d+))?.*?-->/gi;

/**
 * Executes the CodeGuard CLI to get the ACL status for a given path
 * @param path The path to check ACL status for
 * @returns A promise that resolves to the ACL status
 */
export const getAclStatus = async (path: string): Promise<ACLStatus | null> => {
  try {
    const cliPath = getAclCliPath();
    const cleanedPath = cleanPath(path);

    const { stdout } = await exec(`${cliPath} -acl --format json "${cleanedPath}"`);

    try {
      return JSON.parse(stdout) as ACLStatus;
    } catch (e) {
      console.error(`Error parsing ACL status: ${e}`);
      return null;
    }
  } catch (error) {
    console.error(`Error getting ACL status: ${error instanceof Error ? error.message : String(error)}`);
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