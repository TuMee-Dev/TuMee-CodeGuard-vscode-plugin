import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { errorHandler } from '@/utils/error/errorHandler';

export async function createGitignore() {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    void vscode.window.showErrorMessage('No workspace folder open');
    return;
  }

  let targetFolder = workspaceFolders[0];

  // If multiple workspace folders, let user choose
  if (workspaceFolders.length > 1) {
    const selected = await vscode.window.showQuickPick(
      workspaceFolders.map(folder => ({
        label: folder.name,
        folder: folder
      })),
      { placeHolder: 'Select workspace folder for .gitignore' }
    );

    if (!selected) {
      return;
    }
    targetFolder = selected.folder;
  }

  const gitignorePath = path.join(targetFolder.uri.fsPath, '.gitignore');

  if (fs.existsSync(gitignorePath)) {
    const overwrite = await vscode.window.showWarningMessage(
      '.gitignore already exists. Overwrite?',
      'Yes',
      'No'
    );

    if (overwrite !== 'Yes') {
      return;
    }
  }

  // Basic .gitignore template
  const template = `# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Build outputs
dist/
build/
out/
*.log

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Environment variables
.env
.env.local
.env.*.local

# Temporary files
*.tmp
*.temp
`;

  try {
    await fs.promises.writeFile(gitignorePath, template);

    // Open the file
    const doc = await vscode.workspace.openTextDocument(gitignorePath);
    await vscode.window.showTextDocument(doc);

    void vscode.window.showInformationMessage('Created .gitignore file');
  } catch (error) {
    errorHandler.handleError(
      error instanceof Error ? error : new Error(String(error)),
      {
        operation: 'createGitignore',
        userFriendlyMessage: 'Failed to create .gitignore file',
        details: { gitignorePath }
      }
    );
  }
}