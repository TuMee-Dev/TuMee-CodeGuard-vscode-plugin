import type { ExtensionContext } from "vscode";
import { window } from "vscode";

export const EXTENSION_NAME = "tumee-vscode-plugin";

export const getExtensionWithOptionalName = (name?: string): string => {
  return name ? `${EXTENSION_NAME}.${name}` : EXTENSION_NAME;
};

export const cleanPath = (path: string): string => {
  return path.replace(/\\/g, "/").replace(/\/+$/, "");
};

export const firstTimeRun = (context: ExtensionContext): void => {
  const hasRun = context.globalState.get("hasRun");
  if (!hasRun) {
    context.globalState.update("hasRun", true);
    window.showInformationMessage(
      "TuMee File and Folder Customization is now active. Right-click on a file or folder to customize it."
    );
  }
};

export * from "./config";
export * from "./fs";
export * from "./acl";