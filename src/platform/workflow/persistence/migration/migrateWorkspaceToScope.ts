/**
 * Workspace-to-scope migration
 *
 * Moves drafts stored under a bare workspace id into a user-scoped key space.
 * The destination index is written last so a partial copy never looks
 * complete, and the source is removed only after the destination is whole.
 */

import {
  deletePayloads,
  getPayloadKeys,
  readIndex,
  readPayload,
  writeIndex,
  writePayload
} from '../base/storageIO'
import { StorageKeys } from '../base/storageKeys'

const restorePointerKeys = [
  StorageKeys.lastActivePath,
  StorageKeys.lastOpenPaths
]

export function migrateWorkspaceToScope(
  workspaceId: string,
  scope: string
): void {
  const index = readIndex(workspaceId)
  if (index === null) return

  const draftKeys = getPayloadKeys(workspaceId)
  if (readIndex(scope) !== null) {
    removeScopeArtifacts(workspaceId, draftKeys)
    return
  }

  const copied =
    draftKeys.every((draftKey) => copyPayload(workspaceId, scope, draftKey)) &&
    restorePointerKeys.every((keyFor) =>
      copyRestorePointer(keyFor, workspaceId, scope)
    ) &&
    writeIndex(scope, index)

  removeScopeArtifacts(copied ? workspaceId : scope, draftKeys)
}

function removeScopeArtifacts(scope: string, draftKeys: string[]): void {
  deletePayloads(scope, draftKeys)
  localStorage.removeItem(StorageKeys.draftIndex(scope))
  for (const keyFor of restorePointerKeys) {
    localStorage.removeItem(keyFor(scope))
  }
}

function copyPayload(
  workspaceId: string,
  scope: string,
  draftKey: string
): boolean {
  const payload = readPayload(workspaceId, draftKey)
  if (payload === null) return true
  return writePayload(scope, draftKey, payload)
}

function copyRestorePointer(
  keyFor: (workspaceId: string) => string,
  workspaceId: string,
  scope: string
): boolean {
  const json = localStorage.getItem(keyFor(workspaceId))
  if (!json) return true

  try {
    const pointer: unknown = JSON.parse(json)
    if (typeof pointer !== 'object' || pointer === null) return true
    localStorage.setItem(
      keyFor(scope),
      JSON.stringify({ ...pointer, workspaceId: scope })
    )
    return true
  } catch {
    return false
  }
}
