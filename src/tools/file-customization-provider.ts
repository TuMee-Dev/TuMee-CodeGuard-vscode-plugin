import type { Event, ExtensionContext, FileDecorationProvider, Uri } from 'vscode';
import { EventEmitter, FileDecoration, ThemeColor, extensions, window, workspace, commands } from 'vscode';
import type { Change, ExtensionItem, GitAPIState, GitRepository } from '@/types';
import { cleanPath, getExtensionWithOptionalName, isCliAvailable, getAclCliPath, getACLCache, errorHandler, configManager, CONFIG_KEYS } from '@/utils';

const GIT_EXTENSION_ID = 'vscode.git';
const GIT_API_VERSION = 1;

// CLI notification tracking
const CLI_NOTIFICATION_KEY = 'lastCliNotificationTime';
const CLI_NOTIFICATION_INTERVAL = 10 * 60 * 1000; // 10 minutes in milliseconds

export class FileCustomizationProvider implements FileDecorationProvider {
  private readonly _onDidChangeFileDecorations: EventEmitter<Uri | Uri[] | undefined> = new EventEmitter<
    Uri | Uri[] | undefined
  >();
  private context: ExtensionContext | undefined;

  get onDidChangeFileDecorations() {
    return this._onDidChangeFileDecorations.event;
  }

  private _gitAPI: {
    onDidChangeState: Event<GitAPIState>;
    onDidOpenRepository: Event<GitRepository>;
    onDidCloseRepository: Event<GitRepository>;
    getAPI: (version: number) => unknown;
    repositories: GitRepository[];
  } | null = null;

  private async initializeGitAPI() {
    const gitExtension = extensions.getExtension(GIT_EXTENSION_ID);

    if (gitExtension) {
      const activeGitExtension = (gitExtension.isActive ? gitExtension.exports : await gitExtension.activate()) as unknown;

      if (activeGitExtension && typeof activeGitExtension === 'object' && 'getAPI' in activeGitExtension) {
        // Type assertion is necessary here as VS Code's git extension API is not fully typed
        const gitAPI = (activeGitExtension as { getAPI: (version: number) => unknown }).getAPI(GIT_API_VERSION) as typeof this._gitAPI;
        this._gitAPI = gitAPI;

        this._gitAPI?.onDidChangeState(() => {
          this.fireOnChange();
        });
        this._gitAPI?.onDidOpenRepository((repo) => {
          repo.state.onDidChange(() => {
            this.fireOnChange();
          });
          this.fireOnChange();
        });
        this._gitAPI?.onDidCloseRepository(() => {
          this.fireOnChange();
        });

        this.fireOnChange();
      }
    }
  }

  private getAllGitChanges(): Change[] {
    if (this._gitAPI && this._gitAPI.repositories && this._gitAPI.repositories.length > 0) {
      return this._gitAPI.repositories.reduce((acc, repo) => {
        return [
          ...acc,
          ...(repo.state.workingTreeChanges || []),
          ...(repo.state.untrackedChanges || []),
          ...(repo.state.untrackedTreeChanges || []),
          ...(repo.state.indexChanges || []),
          ...(repo.state.mergeChanges || []),
        ];
      }, [] as Change[]);
    }
    return [];
  }

  public fireOnChange() {
    this._onDidChangeFileDecorations.fire(undefined);
  }

  constructor(context?: ExtensionContext) {
    this.context = context;
    void this.initializeGitAPI();

    workspace.onDidChangeConfiguration((e) => {
      if (
        e.affectsConfiguration(`${getExtensionWithOptionalName()}.items`) ||
        e.affectsConfiguration(`${getExtensionWithOptionalName()}.colorChangedFiles`)
      ) {
        this.fireOnChange();
      }
    });
  }

  /**
   * @param uri {Uri} Location of the file or folder
   * @param ignore {boolean} Whether to ignore this and always return false
   * @returns {boolean} Whether the file or folder has been changed
   */
  private isUriChanged(uri: Uri, ignore?: boolean): boolean {
    if (ignore) {
      return false;
    }
    const changes = this.getAllGitChanges();

    return changes.length === 0
      ? false
      : changes.some((change) => {
        return (
          change.uri.path === uri.path ||
            change.uri.path.includes(uri.path) ||
            (change.originalUri &&
              (change.originalUri.path === uri.path || change.originalUri.path.includes(uri.path))) ||
            (change.renameUri && (change.renameUri.path === uri.path || change.renameUri.path.includes(uri.path)))
        );
      });
  }

  /**
   * Shows a notification about CLI not being available, but only once every 10 minutes
   */
  private async showCliNotAvailableNotification(): Promise<void> {
    if (!this.context) return;

    const lastNotificationTime = this.context.globalState.get<number>(CLI_NOTIFICATION_KEY) || 0;
    const now = Date.now();

    if (now - lastNotificationTime < CLI_NOTIFICATION_INTERVAL) {
      return; // Don't show if we've shown recently
    }

    await this.context.globalState.update(CLI_NOTIFICATION_KEY, now);

    const cliPath = getAclCliPath();

    errorHandler.showWarning(`CodeGuard CLI not found at '${cliPath}'. File coloring disabled.`);
    void window.showWarningMessage(
      `CodeGuard CLI not found at '${cliPath}'. File coloring disabled.`,
      'Open Settings'
    ).then(action => {
      if (action === 'Open Settings') {
        void commands.executeCommand('workbench.action.openSettings', 'tumee-vscode-plugin.aclCliPath');
      }
    });
  }

  /**
   * Determines the appropriate color based on ACL status
   * @param aclCode The ACL code (e.g., "AI-RO:HU-ED")
   * @returns The theme color ID or undefined
   */
  private getColorFromACL(aclCode: string | null): string | undefined {
    if (!aclCode) {
      return undefined;
    }

    const hasAI = aclCode.includes('AI-ED');
    const hasHuman = aclCode.includes('HU-ED');

    if (hasAI && hasHuman) {
      return 'tumee.humanAI';
    } else if (hasAI) {
      return 'tumee.ai';
    }
    // Don't color human-only files
    // else if (hasHuman) {
    //   return 'tumee.human';
    // }

    return undefined;
  }

  public async getDecorationValue(uri: Uri): Promise<{ color?: ThemeColor; badge?: string; tooltip?: string } | null> {
    const cm = configManager();
    const items = cm.get(CONFIG_KEYS.ITEMS, [] as Array<ExtensionItem>);
    const ignoreChangedFiles = cm.get('colorChangedFiles', false);

    const isUriChanged = this.isUriChanged(uri, ignoreChangedFiles);
    const projectPath = cleanPath(uri.fsPath);

    // Determine if this is a file or folder
    let isDirectory = false;
    try {
      const fileStat = await workspace.fs.stat(uri);
      isDirectory = (fileStat.type & 1) === 1; // FileType.Directory === 1
    } catch (error) {
      errorHandler.handleError(
        error instanceof Error ? error : new Error(String(error)),
        {
          operation: 'getDecorationValue.stat',
          details: { uri: uri.toString() }
        }
      );
      return null;
    }

    // Check if we have any custom settings for this exact file/folder or parent folders
    // First look for exact path matches, then parent paths
    const exactMatch = items.find(item => item.path === projectPath);

    // If no exact match or the item is of a different type, look for parent folders that include this path
    const parentMatches = !exactMatch ?
      items
        .filter((item) =>
          projectPath.includes(item.path) &&
          (item.type === 'any' || (isDirectory && item.type === 'folder') || (!isDirectory && item.type === 'file'))
        )
        .sort((a, b) => b.path.length - a.path.length)
      : [];

    // Combine all matching items, with exact match taking priority
    const matchItems = exactMatch ? [exactMatch, ...parentMatches] : parentMatches;

    // Find most specific match for each attribute
    const firstMatchWithColor = matchItems.find((item) => item.color);
    const firstMatchWithBadge = matchItems.find((item) => item.badge);
    const firstMatchWithTooltip = matchItems.find((item) => item.tooltip);

    // Check if CLI is available before trying to get ACL status
    let aclColorId: string | undefined;
    let tooltipText: string | undefined;
    const cliAvailable = await isCliAvailable();

    if (!cliAvailable) {
      // Show notification (rate-limited to once per 10 minutes)
      void this.showCliNotAvailableNotification();
      // Don't apply ACL-based coloring when CLI is not available
      aclColorId = undefined;
    } else {
      // Get the ACL status from CodeGuard CLI (using cache)
      const aclCache = getACLCache();
      const aclStatus = await aclCache.getACLStatus(projectPath);
      aclColorId = this.getColorFromACL(aclStatus?.code || null);

      // Create tooltip string based on ACL status
      if (aclStatus && aclStatus.status === 'success') {
        if (!firstMatchWithTooltip || !firstMatchWithTooltip.tooltip || firstMatchWithTooltip.tooltip === '__blocked__') {
          tooltipText = `AI: ${aclStatus.permissions.ai}, Human: ${aclStatus.permissions.human}`;
        }
      }
    }

    // Determine the final color - give priority to manually set color over ACL-based color
    let finalColorId: string | undefined;

    if (firstMatchWithColor && firstMatchWithColor.color !== '__blocked__' && !isUriChanged) {
      finalColorId = firstMatchWithColor.color;
    } else if (aclColorId && !isUriChanged) {
      finalColorId = aclColorId;
    }

    // Override with manual tooltip if available
    if (firstMatchWithTooltip && firstMatchWithTooltip.tooltip && firstMatchWithTooltip.tooltip !== '__blocked__') {
      tooltipText = firstMatchWithTooltip.tooltip;
    }

    // Create badge
    const badge = firstMatchWithBadge?.badge;
    const badgeText = badge && badge !== '__blocked__' && badge.length > 0 && badge.length <= 2 ? badge : undefined;

    // Only return a decoration if we have at least one attribute to show
    if (finalColorId || badgeText || tooltipText) {
      return {
        color: finalColorId ? new ThemeColor(finalColorId) : undefined,
        badge: badgeText,
        tooltip: tooltipText,
      };
    }

    return null;
  }

  async provideFileDecoration(uri: Uri): Promise<FileDecoration | undefined> {
    try {
      const decoration = await this.getDecorationValue(uri);
      if (decoration !== null) {
        return new FileDecoration(decoration.badge, decoration.tooltip, decoration.color);
      }
      return undefined;
    } catch (error) {
      errorHandler.handleError(
        error instanceof Error ? error : new Error(String(error)),
        {
          operation: 'provideFileDecoration',
          details: { uri: uri.toString() },
          userFriendlyMessage: 'Failed to update file decoration'
        }
      );
      return undefined;
    }
  }
}

export const registerFileDecorationProvider = (context: ExtensionContext) => {
  const provider = new FileCustomizationProvider(context);
  const disposable = window.registerFileDecorationProvider(provider);
  context.subscriptions.push(disposable);

  return {
    provider,
    disposable,
  };
};