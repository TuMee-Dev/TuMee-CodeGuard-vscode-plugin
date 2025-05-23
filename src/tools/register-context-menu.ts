import type { ExtensionContext } from 'vscode';
import {
  blockBadge,
  clearACL,
  clearBadge,
  clearColor,
  clearCustomization,
  clearTooltip,
  resetWorkspace,
  setAsAI,
  setAsHuman,
} from '@/tools/contextMenu/noInteraction';
import setColor from '@/tools/contextMenu/setColor';
import setEmojiBadge from '@/tools/contextMenu/setEmojiBadge';
import setTextBadge from '@/tools/contextMenu/setTextBadge';
import setTooltip from '@/tools/contextMenu/setTooltip';
import type { FileCustomizationProvider } from '@/tools/file-customization-provider';

export const registerContextMenu = (context: ExtensionContext, provider: FileCustomizationProvider) => {
  const disposables = [
    setColor(provider, context),
    clearColor(provider),

    setAsHuman(provider),
    setAsAI(provider),
    clearACL(provider),

    setTextBadge(provider),
    setEmojiBadge(provider),
    blockBadge(provider),
    clearBadge(provider),

    setTooltip(provider),
    clearTooltip(provider),

    clearCustomization(provider),
    resetWorkspace(provider),
  ];
  context.subscriptions.push(...disposables);
  return disposables;
};