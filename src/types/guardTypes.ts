// Type definitions for guard tag system

import type { Range } from 'vscode';

export interface GuardTag {
  lineNumber: number;
  identifier?: string;
  scope?: string;
  lineCount?: number;
  addScopes?: string[];
  removeScopes?: string[];
  scopeStart?: number;
  scopeEnd?: number;
  // Store the actual permissions for each target
  aiPermission?: 'r' | 'w' | 'n' | 'contextWrite';
  humanPermission?: 'r' | 'w' | 'n' | 'contextWrite';
  // Track if permissions are context-based
  aiIsContext?: boolean;
  humanIsContext?: boolean;
}

export interface LinePermission {
  line: number;
  permissions: {
    [target: string]: string;  // e.g., { ai: 'w', human: 'r' }
  };
  isContext: {
    [target: string]: boolean;  // e.g., { ai: true, human: false }
  };
  identifier?: string;
  isTrailingWhitespace?: boolean;  // True if this is trailing whitespace at end of a guard scope
  underlyingPermissions?: {  // Permissions to use if this is trailing whitespace
    [target: string]: string;
  };
}

export interface DecorationRanges {
  // All permission combinations
  aiRead_humanRead: { range: Range }[];
  aiRead_humanWrite: { range: Range }[];
  aiRead_humanNoAccess: { range: Range }[];
  aiWrite_humanRead: { range: Range }[];
  aiWrite_humanWrite: { range: Range }[];
  aiWrite_humanNoAccess: { range: Range }[];
  aiNoAccess_humanRead: { range: Range }[];
  aiNoAccess_humanWrite: { range: Range }[];
  aiNoAccess_humanNoAccess: { range: Range }[];

  // Context variants (context modifies existing permissions)
  aiReadContext_humanRead: { range: Range }[];
  aiReadContext_humanWrite: { range: Range }[];
  aiReadContext_humanNoAccess: { range: Range }[];
  aiWriteContext_humanRead: { range: Range }[];
  aiWriteContext_humanWrite: { range: Range }[];
  aiWriteContext_humanNoAccess: { range: Range }[];

}
