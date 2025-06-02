import type { Uri } from 'vscode';
import { workspace } from 'vscode';

/**
 * Filters an array of Uris to only include those that exist
 * @param uris Array of Uris to filter
 * @returns Filtered array of Uris
 */
export const filterUris = async (uris: Array<Uri>): Promise<Array<Uri>> => {
  if (!uris || !uris.length) {
    return [];
  }

  const filteredUris: Uri[] = [];

  for (const uri of uris) {
    try {
      await workspace.fs.stat(uri);
      filteredUris.push(uri);
    } catch (e) {
      // URI doesn't exist, skip it
    }
  }

  return filteredUris;
};

/**
 * Filters an array of Uris to only include folders
 * @param uris Array of Uris to filter
 * @returns Filtered array of Uris
 */
export const filterFolders = async (uris: Array<Uri>): Promise<Array<Uri>> => {
  if (!uris || !uris.length) {
    return [];
  }

  const filteredUris: Uri[] = [];

  for (const uri of uris) {
    try {
      const stat = await workspace.fs.stat(uri);
      if ((stat.type & 1) === 1) { // FileType.Directory === 1
        filteredUris.push(uri);
      }
    } catch (e) {
      // URI doesn't exist, skip it
    }
  }

  return filteredUris;
};

/**
 * Filters an array of Uris to only include files
 * @param uris Array of Uris to filter
 * @returns Filtered array of Uris
 */
export const filterFiles = async (uris: Array<Uri>): Promise<Array<Uri>> => {
  if (!uris || !uris.length) {
    return [];
  }

  const filteredUris: Uri[] = [];

  for (const uri of uris) {
    try {
      const stat = await workspace.fs.stat(uri);
      if ((stat.type & 1) !== 1) { // FileType.Directory === 1
        filteredUris.push(uri);
      }
    } catch (e) {
      // URI doesn't exist, skip it
    }
  }

  return filteredUris;
};