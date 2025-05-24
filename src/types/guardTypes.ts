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
  target: 'ai' | 'human';
  permission: 'r' | 'w' | 'n' | 'context';
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
  aiWrite: { range: Range }[];
  aiNoAccess: { range: Range }[];
  humanReadOnly: { range: Range }[];
  humanNoAccess: { range: Range }[];
  context: { range: Range }[];
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