import type { ExtensionContext, QuickPickItem } from 'vscode';
import type { ExtensionItem, ExtensionItemInput } from '@/types';
import { configManager, CONFIG_KEYS } from './configurationManager';

export const getColorsForPicker = (_context: ExtensionContext): Array<QuickPickItem> => {
  const pickItems = [
    {
      label: 'Human-Editable',
      description: 'tumee.human',
      detail: 'Files and folders that are editable by humans only',
    },
    {
      label: 'AI-Editable',
      description: 'tumee.ai',
      detail: 'Files and folders that are editable by AI only',
    },
    {
      label: 'Human and AI Editable',
      description: 'tumee.humanAI',
      detail: 'Files and folders that are editable by both humans and AI',
    },
    {
      label: 'Custom Color',
      description: '__custom__',
      detail: 'Pick a custom color',
    },
  ];

  return pickItems;
};

const updateConfigItem = (
  item: ExtensionItemInput,
  opts: { provider?: { fireOnChange: () => void } } = {},
): boolean => {
  const { provider } = opts;

  const cm = configManager();
  const items = cm.get(CONFIG_KEYS.ITEMS, [] as Array<ExtensionItem>);

  const itemWithSamePath = items.findIndex((f) => f.path === item.path);

  if (itemWithSamePath === -1) {
    items.push({
      path: item.path,
      ...(item.color && { color: item.color }),
      ...(item.badge && { badge: item.badge }),
      ...(item.tooltip && { tooltip: item.tooltip }),
      ...(item.type && { type: item.type }),
      ...(item.isAI !== null && { isAI: item.isAI }),
      ...(item.isHuman !== null && { isHuman: item.isHuman }),
    });
  } else {
    const folder = items[itemWithSamePath];

    if (item.color !== undefined) {
      folder.color = item.color || undefined;
    }

    if (item.badge !== undefined) {
      folder.badge = item.badge || undefined;
    }

    if (item.tooltip !== undefined) {
      folder.tooltip = item.tooltip || undefined;
    }

    if (item.type !== undefined) {
      folder.type = item.type || undefined;
    }

    if (item.isAI !== undefined) {
      folder.isAI = item.isAI || undefined;
    }

    if (item.isHuman !== undefined) {
      folder.isHuman = item.isHuman || undefined;
    }

    items[itemWithSamePath] = folder;
  }

  void cm.update(CONFIG_KEYS.ITEMS, items).then(() => {
    if (provider && typeof provider.fireOnChange === 'function') {
      provider.fireOnChange();
    }
  });

  return true;
};

export const updateConfigForAll = (
  items: Array<ExtensionItemInput>,
  opts: { provider?: { fireOnChange: () => void } } = {},
): boolean => {
  return items.every((item) => updateConfigItem(item, opts));
};

export const removePathFromConfig = (path: string, opts: { provider?: { fireOnChange: () => void } } = {}): boolean => {
  const { provider } = opts;

  const cm = configManager();
  const folders = cm.get(CONFIG_KEYS.ITEMS, [] as Array<ExtensionItem>);

  const newFolders = folders.filter((f) => f.path !== path);

  void cm.update(CONFIG_KEYS.ITEMS, newFolders).then(() => {
    if (provider && typeof provider.fireOnChange === 'function') {
      provider.fireOnChange();
    }
  });

  return true;
};

export const removeAllFromConfig = (opts: { provider?: { fireOnChange: () => void } } = {}): boolean => {
  const { provider } = opts;

  const cm = configManager();

  void cm.update(CONFIG_KEYS.ITEMS, []).then(() => {
    if (provider && typeof provider.fireOnChange === 'function') {
      provider.fireOnChange();
    }
  });

  return true;
};

