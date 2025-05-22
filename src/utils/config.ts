import type { ExtensionContext } from "vscode";
import { QuickPickItem, window, workspace } from "vscode";
import type { ExtensionItem, ExtensionItemInput } from "@/types";
import { getExtensionWithOptionalName } from ".";
import type { FileDecorationProvider } from "vscode";

export const getColorsForPicker = async (context: ExtensionContext): Promise<Array<QuickPickItem>> => {
  const pickItems = [
    {
      label: "Human-Editable",
      description: "tumee.human",
      detail: "Files and folders that are editable by humans only",
    },
    {
      label: "AI-Editable",
      description: "tumee.ai",
      detail: "Files and folders that are editable by AI only",
    },
    {
      label: "Human and AI Editable",
      description: "tumee.humanAI",
      detail: "Files and folders that are editable by both humans and AI",
    },
    {
      label: "Custom Color",
      description: "__custom__",
      detail: "Pick a custom color",
    },
  ];

  return pickItems;
};

export const updateConfig = (
  item: ExtensionItemInput,
  opts: { provider?: any } = {},
): boolean => {
  const { provider } = opts;

  const config = workspace.getConfiguration(getExtensionWithOptionalName());
  const items = config.get<Array<ExtensionItem>>("items") || [];

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

  config.update("items", items).then(() => {
    if (provider && typeof provider.fireOnChange === 'function') {
      provider.fireOnChange();
    }
  });

  return true;
};

export const updateConfigForAll = (
  items: Array<ExtensionItemInput>,
  opts: { provider?: any } = {},
): boolean => {
  return items.every((item) => updateConfig(item, opts));
};

export const removePathFromConfig = (path: string, opts: { provider?: any } = {}): boolean => {
  const { provider } = opts;

  const config = workspace.getConfiguration(getExtensionWithOptionalName());
  const folders = config.get<Array<ExtensionItem>>("items") || [];

  const newFolders = folders.filter((f) => f.path !== path);

  config.update("items", newFolders).then(() => {
    if (provider && typeof provider.fireOnChange === 'function') {
      provider.fireOnChange();
    }
  });

  return true;
};

export const removeAllFromConfig = (opts: { provider?: any } = {}): boolean => {
  const { provider } = opts;

  const config = workspace.getConfiguration(getExtensionWithOptionalName());

  config.update("items", []).then(() => {
    if (provider && typeof provider.fireOnChange === 'function') {
      provider.fireOnChange();
    }
  });

  return true;
};

export const getCustomizationForPath = (path: string): ExtensionItem | null => {
  const config = workspace.getConfiguration(getExtensionWithOptionalName());
  const items = config.get<Array<ExtensionItem>>("items") || [];

  const item = items.find((f) => f.path === path);

  return item || null;
};