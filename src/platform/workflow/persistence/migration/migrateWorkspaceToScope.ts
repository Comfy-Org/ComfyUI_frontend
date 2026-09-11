import {
  deletePayloads,
  getPayloadKeys,
  readIndex,
  readLocalPointer,
  readPayload,
  removeStorageKeys,
  writeIndex,
  writePayload,
  writeStorage
} from '../base/storageIO'
import { StorageKeys } from '../base/storageKeys'

type MigrationClaim = {
  scope: string
  sourceUpdatedAt: number
}

const restorePointerKeys = [
  StorageKeys.lastActivePath,
  StorageKeys.lastOpenPaths
]

function isValidClaim(value: unknown): value is MigrationClaim {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.scope === 'string' &&
    typeof candidate.sourceUpdatedAt === 'number'
  )
}

export function migrateWorkspaceToScope(
  workspaceId: string,
  scope: string
): void {
  const index = readIndex(workspaceId)
  if (!index) return

  const claimKey = StorageKeys.migrationClaim(workspaceId)
  const existingClaim = readLocalPointer(claimKey, isValidClaim)
  if (existingClaim && existingClaim.scope !== scope) return

  const draftKeys = getPayloadKeys(workspaceId)

  if (readIndex(scope)) {
    const ownsDestination =
      existingClaim !== null && index.updatedAt <= existingClaim.sourceUpdatedAt
    if (!ownsDestination) return
    removeScopeArtifacts(workspaceId, draftKeys, restorePointerKeys)
    removeStorageKeys(localStorage, [claimKey])
    return
  }

  const claim: MigrationClaim = { scope, sourceUpdatedAt: index.updatedAt }
  if (!writeStorage(localStorage, claimKey, JSON.stringify(claim))) return
  const committedClaim = readLocalPointer(claimKey, isValidClaim)
  if (committedClaim?.scope !== scope) return

  const missingPointerKeys = restorePointerKeys.filter(
    (keyFor) => localStorage.getItem(keyFor(scope)) === null
  )

  const copied =
    draftKeys.every((draftKey) => copyPayload(draftKey, workspaceId, scope)) &&
    missingPointerKeys.every((keyFor) =>
      copyRestorePointer(keyFor, workspaceId, scope)
    ) &&
    writeIndex(scope, index)

  if (copied) {
    removeScopeArtifacts(workspaceId, draftKeys, restorePointerKeys)
  } else {
    removeScopeArtifacts(scope, draftKeys, missingPointerKeys)
  }
  removeStorageKeys(localStorage, [claimKey])
}

function removeScopeArtifacts(
  scope: string,
  draftKeys: string[],
  pointerKeys: ((scope: string) => string)[]
): void {
  deletePayloads(scope, draftKeys)
  removeStorageKeys(localStorage, [
    StorageKeys.draftIndex(scope),
    ...pointerKeys.map((keyFor) => keyFor(scope))
  ])
}

function copyPayload(
  draftKey: string,
  workspaceId: string,
  scope: string
): boolean {
  const payload = readPayload(workspaceId, draftKey)
  if (!payload) return false
  return writePayload(scope, draftKey, payload)
}

function copyRestorePointer(
  keyFor: (scope: string) => string,
  workspaceId: string,
  scope: string
): boolean {
  try {
    const raw = localStorage.getItem(keyFor(workspaceId))
    if (raw === null) return true
    const pointer: unknown = JSON.parse(raw)
    if (typeof pointer !== 'object' || pointer === null) return false
    return writeStorage(
      localStorage,
      keyFor(scope),
      JSON.stringify({ ...pointer, workspaceId: scope })
    )
  } catch {
    return false
  }
}
