import type { ExtensionContext, Uri } from "vscode";
import { commands, window, workspace } from "vscode";
import { updateConfigForAll } from "@/utils/config";
import { filterUris } from "@/utils/fs";
import type { FileCustomizationProvider } from "@/tools/file-customization-provider";
import { cleanPath, getColorsForPicker, getExtensionWithOptionalName } from "@/utils";
import type { ExtensionItemInput } from "@/types";

const disposable = (provider: FileCustomizationProvider, context: ExtensionContext) =>
  commands.registerCommand(getExtensionWithOptionalName("setColor"), async (_, uris: Array<Uri>) => {
    const filtered = await filterUris(uris);
    if (!filtered.length) {
      return;
    }

    const availableColors = await getColorsForPicker(context);
    const selected = await window.showQuickPick(availableColors, {
      placeHolder: "Select a color",
    });

    if (!selected) {
      return;
    }

    const colorValue = selected.description === "__custom__"
      ? await window.showInputBox({
          placeHolder: "Enter a color (e.g., #RRGGBB or a predefined theme color)",
          prompt: "Enter a custom color value",
        })
      : selected.description;

    if (!colorValue) {
      return;
    }

    // Process each URI and determine if it's a file or folder
    const itemPromises = filtered.map(async (uri) => {
      try {
        const fileStat = await workspace.fs.stat(uri);
        const isDirectory = (fileStat.type & 1) === 1; // FileType.Directory === 1

        return {
          path: cleanPath(uri.fsPath),
          color: colorValue,
          type: isDirectory ? "folder" : "file",
        } as ExtensionItemInput;
      } catch (error) {
        console.error(`Error getting file stat: ${error instanceof Error ? error.message : String(error)}`);
        return null;
      }
    });

    // Wait for all promises to resolve
    const items = (await Promise.all(itemPromises)).filter((item): item is ExtensionItemInput => item !== null);

    if (items.length > 0) {
      updateConfigForAll(items, { provider });
    }
  });

export default disposable;