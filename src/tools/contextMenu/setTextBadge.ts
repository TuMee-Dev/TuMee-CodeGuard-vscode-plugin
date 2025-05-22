import type { Uri } from "vscode";
import { commands, window } from "vscode";
import { updateConfigForAll } from "@/utils/config";
import { filterUris } from "@/utils/fs";
import type { FileCustomizationProvider } from "@/tools/file-customization-provider";
import { cleanPath, getExtensionWithOptionalName } from "@/utils";

const disposable = (provider: FileCustomizationProvider) =>
  commands.registerCommand(getExtensionWithOptionalName("setTextBadge"), async (_, uris: Array<Uri>) => {
    const filtered = await filterUris(uris);
    if (!filtered.length) {
      return;
    }

    const selected = await window.showInputBox({
      placeHolder: "Enter a text badge (max 2 characters)",
      validateInput: (value) => {
        if (value.length > 2) {
          return "Badge must be at most 2 characters";
        }
        return null;
      },
    });

    if (!selected) {
      return;
    }

    updateConfigForAll(
      filtered.map((uri) => ({
        path: cleanPath(uri.fsPath),
        badge: selected,
      })),
      { provider },
    );
  });

export default disposable;