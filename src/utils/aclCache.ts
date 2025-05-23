import * as path from 'path';
import type { FileSystemWatcher } from 'vscode';
import { workspace, Uri, RelativePattern } from 'vscode';
import { getAclStatus } from './acl';
import type { ACLStatus } from '@/types';

interface CacheEntry {
  status: ACLStatus | null;
  timestamp: number;
}

export class ACLCache {
  private cache = new Map<string, CacheEntry>();
  private fileWatcher: FileSystemWatcher | undefined;
  private aiAttributesWatchers = new Map<string, FileSystemWatcher>();

  // Cache entries for 5 minutes by default
  private readonly CACHE_TTL = 5 * 60 * 1000;

  constructor() {
    this.setupWatchers();
  }

  /**
   * Get ACL status for a file, using cache if available and valid
   */
  async getACLStatus(filePath: string): Promise<ACLStatus | null> {
    const cleanPath = this.normalizePath(filePath);
    const cached = this.cache.get(cleanPath);

    // Check if cache entry exists and is still valid
    if (cached && this.isCacheValid(cached)) {
      return cached.status;
    }

    // Query ACL system
    const status = await getAclStatus(cleanPath);

    // Update cache
    this.cache.set(cleanPath, {
      status,
      timestamp: Date.now()
    });

    // Set up watcher for this file's directory if not already watching
    this.watchDirectoryForAIAttributes(path.dirname(cleanPath));

    return status;
  }

  /**
   * Invalidate cache for a specific file
   */
  invalidateFile(filePath: string): void {
    const cleanPath = this.normalizePath(filePath);
    this.cache.delete(cleanPath);
  }

  /**
   * Invalidate all cache entries for files in a directory
   */
  invalidateDirectory(dirPath: string): void {
    const cleanDir = this.normalizePath(dirPath);

    // Remove all cache entries for files in this directory
    for (const [cachedPath] of this.cache) {
      if (cachedPath.startsWith(cleanDir)) {
        this.cache.delete(cachedPath);
      }
    }
  }

  /**
   * Clear entire cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Dispose of watchers and clear cache
   */
  dispose(): void {
    this.fileWatcher?.dispose();
    for (const watcher of this.aiAttributesWatchers.values()) {
      watcher.dispose();
    }
    this.aiAttributesWatchers.clear();
    this.cache.clear();
  }

  private setupWatchers(): void {
    // Watch for workspace changes
    if (workspace.workspaceFolders) {
      // Watch for .ai-attributes files
      this.fileWatcher = workspace.createFileSystemWatcher('**/.ai-attributes');

      // When .ai-attributes file changes, invalidate cache for that directory
      this.fileWatcher.onDidChange((uri) => {
        this.invalidateDirectory(path.dirname(uri.fsPath));
      });

      this.fileWatcher.onDidCreate((uri) => {
        this.invalidateDirectory(path.dirname(uri.fsPath));
      });

      this.fileWatcher.onDidDelete((uri) => {
        this.invalidateDirectory(path.dirname(uri.fsPath));
      });
    }
  }

  private watchDirectoryForAIAttributes(dirPath: string): void {
    const cleanDir = this.normalizePath(dirPath);

    // Already watching this directory
    if (this.aiAttributesWatchers.has(cleanDir)) {
      return;
    }

    // Check all parent directories up to workspace root
    const workspaceFolder = workspace.getWorkspaceFolder(Uri.file(cleanDir));
    if (!workspaceFolder) {
      return;
    }

    let currentDir = cleanDir;
    const workspaceRoot = this.normalizePath(workspaceFolder.uri.fsPath);

    while (currentDir.startsWith(workspaceRoot) && currentDir !== workspaceRoot) {
      const pattern = new RelativePattern(currentDir, '.ai-attributes');

      if (!this.aiAttributesWatchers.has(currentDir)) {
        const watcher = workspace.createFileSystemWatcher(pattern);

        watcher.onDidChange(() => {
          this.invalidateDirectory(currentDir);
        });

        watcher.onDidCreate(() => {
          this.invalidateDirectory(currentDir);
        });

        watcher.onDidDelete(() => {
          this.invalidateDirectory(currentDir);
        });

        this.aiAttributesWatchers.set(currentDir, watcher);
      }

      // Move to parent directory
      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) break; // Reached root
      currentDir = parentDir;
    }
  }

  private isCacheValid(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp < this.CACHE_TTL;
  }

  private normalizePath(filePath: string): string {
    return path.normalize(filePath);
  }
}

// Singleton instance
let aclCacheInstance: ACLCache | undefined;

export function getACLCache(): ACLCache {
  if (!aclCacheInstance) {
    aclCacheInstance = new ACLCache();
  }
  return aclCacheInstance;
}

export function disposeACLCache(): void {
  aclCacheInstance?.dispose();
  aclCacheInstance = undefined;
}