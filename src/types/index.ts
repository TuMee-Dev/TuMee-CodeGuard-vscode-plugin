import type { Uri } from 'vscode';

export type ItemType = 'file' | 'folder' | 'any';

export type ACLStatus = {
  path: string;
  permissions: {
    ai: 'read-only' | 'editable' | 'fixed' | 'none';
    human: 'read-only' | 'editable' | 'fixed' | 'none';
  };
  code: string; // Short form like "AI-RO:HU-ED"
  status: 'success' | 'error';
};

export type ExtensionItem = {
  color?: string;
  path: string;
  type?: ItemType;
  badge?: string;
  tooltip?: string;
  isAI?: boolean;
  isHuman?: boolean;
};

export type ExtensionItemInput = {
  color?: string | null;
  path: string;
  type?: ItemType | null;
  badge?: string | null;
  tooltip?: string | null;
  isAI?: boolean | null;
  isHuman?: boolean | null;
};

export type GitAPIState = 'uninitialized' | 'initialized';

export interface GitRepository {
  state: GitRepositoryState;
  rootUri: {
    fsPath: string;
    path: string;
  };
  repository: {
    getBranches: () => Promise<GitBranch[]>;
  };
}

export type CommandCTX = { fsPath: string; path: string; query: string; scheme: string };

export const enum GitStatus {
  INDEX_MODIFIED,
  INDEX_ADDED,
  INDEX_DELETED,
  INDEX_RENAMED,
  INDEX_COPIED,

  MODIFIED,
  DELETED,
  UNTRACKED,
  IGNORED,
  INTENT_TO_ADD,
  INTENT_TO_RENAME,
  TYPE_CHANGED,

  ADDED_BY_US,
  ADDED_BY_THEM,
  DELETED_BY_US,
  DELETED_BY_THEM,
  BOTH_ADDED,
  BOTH_DELETED,
  BOTH_MODIFIED,
}

export interface Change {
  uri: Uri;
  originalUri: Uri;
  renameUri?: Uri;
  status: GitStatus;
}

export interface GitRepositoryState {
  HEAD?: GitBranch;
  mergeChanges?: Change[];
  workingTreeChanges?: Change[];
  indexChanges?: Change[];
  untrackedChanges?: Change[];
  untrackedTreeChanges?: Change[];
  onDidChange: (listener: () => void) => void;
}

export interface GitBranch {
  type: number;
  name?: string;
  upstream: Upstream;
  commit: string;
  ahead: number;
  behind: number;
}

export interface Upstream {
  name: string;
  remote: string;
  commit: string;
}