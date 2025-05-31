/**
 * Core guard stack operations and permission inheritance - platform agnostic
 * Handles stack manipulation, context guard cleanup, and permission state management
 * No dependencies allowed in this module
 */

import type { GuardTag, GuardStackEntry } from './types';

/**
 * Pop expired guards from stack and clean up any context guards below
 * Context guards cannot resume after being interrupted
 */
export function popGuardWithContextCleanup(guardStack: GuardStackEntry[]): void {
  guardStack.pop();

  // After popping, also pop any context guards below
  // Context guards cannot resume after being interrupted
  while (guardStack.length > 0) {
    const next = guardStack[guardStack.length - 1];
    // Check if any permission in this entry is 'context'
    const hasContextPermission = Object.values(next.permissions).includes('context');
    if (hasContextPermission) {
      guardStack.pop();
    } else {
      break;
    }
  }
}

/**
 * Remove any context guards from the top of the stack
 * Context guards cannot be interrupted and resumed later
 */
export function removeInterruptedContextGuards(guardStack: GuardStackEntry[]): void {
  while (guardStack.length > 0) {
    const top = guardStack[guardStack.length - 1];
    // Check if any permission in this entry is 'context'
    const hasContextPermission = Object.values(top.permissions).includes('context');
    if (hasContextPermission) {
      guardStack.pop();
    } else {
      break;
    }
  }
}

/**
 * Create a new guard stack entry
 */
export function createGuardStackEntry(
  permissions: { [target: string]: string },
  isContext: { [target: string]: boolean },
  startLine: number,
  endLine: number,
  isLineLimited: boolean,
  sourceGuard?: GuardTag
): GuardStackEntry {
  return {
    permissions,
    isContext,
    startLine,
    endLine,
    isLineLimited,
    sourceGuard
  };
}