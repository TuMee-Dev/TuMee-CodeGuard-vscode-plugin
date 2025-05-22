import type { Uri } from "vscode";
import { commands } from "vscode";
import { clearAclStatus, getExtensionWithOptionalName, removeAllFromConfig, removePathFromConfig, setAclStatus, updateConfigForAll } from "@/utils";
import { filterUris } from "@/utils/fs";
import type { FileCustomizationProvider } from "@/tools/file-customization-provider";
import { cleanPath } from "@/utils";

export const clearColor = (provider: FileCustomizationProvider) =>
  commands.registerCommand(getExtensionWithOptionalName("clearColor"), async (_, uris: Array<Uri>) => {
    const filtered = await filterUris(uris);
    if (!filtered.length) {
      return;
    }

    updateConfigForAll(
      filtered.map((uri) => ({
        path: cleanPath(uri.fsPath),
        color: null,
      })),
      { provider },
    );
  });

export const blockBadge = (provider: FileCustomizationProvider) =>
  commands.registerCommand(getExtensionWithOptionalName("blockBadge"), async (_, uris: Array<Uri>) => {
    const filtered = await filterUris(uris);
    if (!filtered.length) {
      return;
    }

    updateConfigForAll(
      filtered.map((uri) => ({
        path: cleanPath(uri.fsPath),
        badge: "__blocked__",
      })),
      { provider },
    );
  });

export const clearBadge = (provider: FileCustomizationProvider) =>
  commands.registerCommand(getExtensionWithOptionalName("clearBadge"), async (_, uris: Array<Uri>) => {
    const filtered = await filterUris(uris);
    if (!filtered.length) {
      return;
    }

    updateConfigForAll(
      filtered.map((uri) => ({
        path: cleanPath(uri.fsPath),
        badge: null,
      })),
      { provider },
    );
  });

export const clearTooltip = (provider: FileCustomizationProvider) =>
  commands.registerCommand(getExtensionWithOptionalName("clearTooltip"), async (_, uris: Array<Uri>) => {
    const filtered = await filterUris(uris);
    if (!filtered.length) {
      return;
    }

    updateConfigForAll(
      filtered.map((uri) => ({
        path: cleanPath(uri.fsPath),
        tooltip: null,
      })),
      { provider },
    );
  });

export const clearCustomization = (provider: FileCustomizationProvider) =>
  commands.registerCommand(getExtensionWithOptionalName("clearCustomization"), async (_, uris: Array<Uri>) => {
    const filtered = await filterUris(uris);
    if (!filtered.length) {
      return;
    }

    filtered.forEach((uri) => {
      removePathFromConfig(cleanPath(uri.fsPath), { provider });
    });
  });

export const resetWorkspace = (provider: FileCustomizationProvider) =>
  commands.registerCommand(getExtensionWithOptionalName("resetWorkspace"), async () => {
    removeAllFromConfig({ provider });
  });

export const setAsHuman = (provider: FileCustomizationProvider) =>
  commands.registerCommand(getExtensionWithOptionalName("setAsHuman"), async (_, uris: Array<Uri>) => {
    const filtered = await filterUris(uris);
    if (!filtered.length) {
      return;
    }

    filtered.forEach(async (uri) => {
      const path = cleanPath(uri.fsPath);
      
      // Set ACL using the command-line tool
      await setAclStatus(path, "HU", "ED");
      
      // Update visual customization
      updateConfigForAll(
        [{
          path: path,
          isHuman: true,
          isAI: false,
          color: "tumee.human"
        }],
        { provider },
      );
    });
  });

export const setAsAI = (provider: FileCustomizationProvider) =>
  commands.registerCommand(getExtensionWithOptionalName("setAsAI"), async (_, uris: Array<Uri>) => {
    const filtered = await filterUris(uris);
    if (!filtered.length) {
      return;
    }

    filtered.forEach(async (uri) => {
      const path = cleanPath(uri.fsPath);
      
      // Set ACL using the command-line tool
      await setAclStatus(path, "AI", "ED");
      
      // Update visual customization
      updateConfigForAll(
        [{
          path: path,
          isHuman: false,
          isAI: true,
          color: "tumee.ai"
        }],
        { provider },
      );
    });
  });

export const clearACL = (provider: FileCustomizationProvider) =>
  commands.registerCommand(getExtensionWithOptionalName("clearACL"), async (_, uris: Array<Uri>) => {
    const filtered = await filterUris(uris);
    if (!filtered.length) {
      return;
    }

    filtered.forEach(async (uri) => {
      const path = cleanPath(uri.fsPath);
      
      // Clear ACL using the command-line tool
      await clearAclStatus(path);
      
      // Update visual customization
      updateConfigForAll(
        [{
          path: path,
          isHuman: null,
          isAI: null,
          color: null
        }],
        { provider },
      );
    });
  });