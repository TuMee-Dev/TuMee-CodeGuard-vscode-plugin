// Type definitions for guard tag system

import type { Range } from 'vscode';

export interface GuardTag {
  lineNumber: number;
  target: 'ai' | 'human';
  identifier?: string;
  permission: 'r' | 'w' | 'n' | 'context';
  scope?: string;
  lineCount?: number;
  addScopes?: string[];
  removeScopes?: string[];
  scopeStart?: number;
  scopeEnd?: number;
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
}

export interface ParsedGuardTag {
  target: string;
  identifier?: string;
  permission: string;
  scope?: string;
  lineCount?: number;
  addScopes?: string[];
  removeScopes?: string[];
  type: string;
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

  [key: string]: { range: Range }[];  // Index signature for dynamic access
}

// Cache types
export interface ScopeCache {
  version: number;
  scopes: Map<string, ScopeBoundary | null>;
}

export interface ScopeBoundary {
  startLine: number;
  endLine: number;
  type: string;
}