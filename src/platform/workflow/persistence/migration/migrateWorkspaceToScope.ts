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
  nonce?: string
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
  const destinationIndex = readIndex(scope)

  if (destinationIndex) {
    const canFinishCleanup =
      existingClaim !== null && index.updatedAt <= existingClaim.sourceUpdatedAt
    const hasNewerSource = index.updatedAt > destinationIndex.updatedAt
    if (!canFinishCleanup && !hasNewerSource) return
  }

  const claim: MigrationClaim = {
    scope,
    sourceUpdatedAt: index.updatedAt,
    nonce: crypto.randomUUID()
  }
  if (!writeStorage(localStorage, claimKey, JSON.stringify(claim))) return
  if (!ownsClaim(claimKey, claim)) return

  if (
    destinationIndex &&
    existingClaim !== null &&
    index.updatedAt <= existingClaim.sourceUpdatedAt
  ) {
    cleanupSourceIfCurrent(workspaceId, draftKeys, claimKey, claim)
    return
  }

  const missingPointerKeys = restorePointerKeys.filter(
    (keyFor) => localStorage.getItem(keyFor(scope)) === null
  )
  const destinationSnapshot = snapshotScopeArtifacts(
    scope,
    draftKeys,
    missingPointerKeys
  )

  const artifactsCopied =
    draftKeys.every((draftKey) => copyPayload(draftKey, workspaceId, scope)) &&
    missingPointerKeys.every((keyFor) =>
      copyRestorePointer(keyFor, workspaceId, scope)
    )
  const published =
    artifactsCopied && ownsClaim(claimKey, claim) && writeIndex(scope, index)
  const copied = published && ownsClaim(claimKey, claim)

  if (copied) {
    cleanupSourceIfCurrent(workspaceId, draftKeys, claimKey, claim)
  } else {
    restoreStorageSnapshot(destinationSnapshot)
    releaseClaimIfOwned(claimKey, claim)
  }
}

function ownsClaim(claimKey: string, claim: MigrationClaim): boolean {
  const committedClaim = readLocalPointer(claimKey, isValidClaim)
  return (
    committedClaim?.scope === claim.scope &&
    committedClaim.sourceUpdatedAt === claim.sourceUpdatedAt &&
    committedClaim.nonce === claim.nonce
  )
}

function releaseClaimIfOwned(claimKey: string, claim: MigrationClaim): void {
  if (ownsClaim(claimKey, claim)) {
    removeStorageKeys(localStorage, [claimKey])
  }
}

function cleanupSourceIfCurrent(
  workspaceId: string,
  draftKeys: string[],
  claimKey: string,
  claim: MigrationClaim
): void {
  if (!ownsClaim(claimKey, claim)) return
  const currentSource = readIndex(workspaceId)
  if (
    currentSource &&
    currentSource.updatedAt <= claim.sourceUpdatedAt &&
    ownsClaim(claimKey, claim)
  ) {
    removeScopeArtifacts(workspaceId, draftKeys, restorePointerKeys)
  }
  releaseClaimIfOwned(claimKey, claim)
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

function snapshotScopeArtifacts(
  scope: string,
  draftKeys: string[],
  pointerKeys: ((scope: string) => string)[]
): Map<string, string | null> {
  const keys = [
    StorageKeys.draftIndex(scope),
    ...draftKeys.map(
      (draftKey) => `${StorageKeys.prefixes.draftPayload}${scope}:${draftKey}`
    ),
    ...pointerKeys.map((keyFor) => keyFor(scope))
  ]
  return new Map(keys.map((key) => [key, localStorage.getItem(key)]))
}

function restoreStorageSnapshot(snapshot: Map<string, string | null>): void {
  for (const [key, value] of snapshot) {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  }
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
