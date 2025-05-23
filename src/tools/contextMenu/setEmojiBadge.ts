import { type Uri, commands, window } from 'vscode';
import { updateConfigForAll } from '@/utils/config';
import { filterUris } from '@/utils/fs';
import type { FileCustomizationProvider } from '@/tools/file-customization-provider';
import { cleanPath, getExtensionWithOptionalName } from '@/utils';

const EMOJI_LIST = [
  { emoji: '⭐', name: 'Star' },
  { emoji: '🚧', name: 'Construction' },
  { emoji: '⚠️', name: 'Warning' },
  { emoji: '🔥', name: 'Fire' },
  { emoji: '💡', name: 'Light Bulb' },
  { emoji: '🔒', name: 'Lock' },
  { emoji: '👤', name: 'Human' },
  { emoji: '🤖', name: 'Robot' },
  { emoji: '🧪', name: 'Test Tube' },
  { emoji: '📝', name: 'Note' },
];

const disposable = (provider: FileCustomizationProvider) =>
  commands.registerCommand(getExtensionWithOptionalName('setEmojiBadge'), async (_, uris: Array<Uri>) => {
    const filtered = await filterUris(uris);
    if (!filtered.length) {
      return;
    }

    const selected = await window.showQuickPick(
      EMOJI_LIST.map((item) => ({
        label: item.emoji,
        description: item.name,
      })),
      {
        placeHolder: 'Select an emoji for badge',
      },
    );

    if (!selected) {
      return;
    }

    updateConfigForAll(
      filtered.map((uri) => ({
        path: cleanPath(uri.fsPath),
        badge: selected.label,
      })),
      { provider },
    );
  });

export default disposable;