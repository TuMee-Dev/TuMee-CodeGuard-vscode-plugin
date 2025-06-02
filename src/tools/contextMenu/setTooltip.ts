import type { Uri } from 'vscode';
import { commands, window } from 'vscode';
import { updateConfigForAll, filterUris } from '@/utils';
import type { FileCustomizationProvider } from '@/tools/file-customization-provider';
import { cleanPath, getExtensionWithOptionalName } from '@/utils';

const disposable = (provider: FileCustomizationProvider) =>
  commands.registerCommand(getExtensionWithOptionalName('setTooltip'), async (_, uris: Array<Uri>) => {
    const filtered = await filterUris(uris);
    if (!filtered.length) {
      return;
    }

    const selected = await window.showInputBox({
      placeHolder: 'Enter a tooltip',
    });

    if (!selected) {
      return;
    }

    updateConfigForAll(
      filtered.map((uri) => ({
        path: cleanPath(uri.fsPath),
        tooltip: selected,
      })),
      { provider },
    );
  });

export default disposable;