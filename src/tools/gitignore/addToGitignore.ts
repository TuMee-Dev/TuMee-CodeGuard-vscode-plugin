import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { errorHandler } from '@/utils/error/errorHandler';

export async function addToGitignore(uri: vscode.Uri) {
  if (!uri) {
    void vscode.window.showErrorMessage('No file or folder selected');
    return;
  }

  const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
  if (!workspaceFolder) {
    void vscode.window.showErrorMessage('No workspace folder found');
    return;
  }

  const gitignorePath = path.join(workspaceFolder.uri.fsPath, '.gitignore');
  const relativePath = path.relative(workspaceFolder.uri.fsPath, uri.fsPath);

  // Normalize path separators for cross-platform compatibility
  const normalizedPath = relativePath.replace(/\\/g, '/');

  // Check if it's a directory
  const stats = await fs.promises.stat(uri.fsPath);
  const pathToAdd = stats.isDirectory() ? `${normalizedPath}/` : normalizedPath;

  try {
    let content = '';
    if (fs.existsSync(gitignorePath)) {
      content = await fs.promises.readFile(gitignorePath, 'utf8');
    }

    // Check if path already exists
    if (content.includes(pathToAdd)) {
      void vscode.window.showInformationMessage(`"${pathToAdd}" is already in .gitignore`);
      return;
    }

    // Add the path
    const newContent = content.length > 0 && !content.endsWith('\n')
      ? `${content}\n${pathToAdd}\n`
      : `${content + pathToAdd}\n`;

    await fs.promises.writeFile(gitignorePath, newContent);
    void vscode.window.showInformationMessage(`Added "${pathToAdd}" to .gitignore`);
  } catch (error) {
    errorHandler.handleError(
      error instanceof Error ? error : new Error(String(error)),
      {
        operation: 'addToGitignore',
        userFriendlyMessage: 'Failed to add to .gitignore',
        details: { path: pathToAdd, gitignorePath }
      }
    );
  }
}