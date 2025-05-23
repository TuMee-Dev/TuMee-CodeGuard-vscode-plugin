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
  target: 'ai' | 'human' | null;
  permission: string;
  lineCount?: number;
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
  documentVersion: number;
  scopes: Map<string, ScopeBoundary | null>;
}

export interface ScopeBoundary {
  startLine: number;
  endLine: number;
  type: string;
}