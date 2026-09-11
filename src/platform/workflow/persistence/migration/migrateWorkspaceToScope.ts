import {
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

type MigrationCompletion = MigrationClaim & {
  completedAt: number
  nonce: string
}

const migrationCompletionLifetime = 60_000

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

function isCurrentCompletion(value: unknown): value is MigrationCompletion {
  if (!isValidClaim(value)) return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.nonce === 'string' &&
    typeof candidate.completedAt === 'number' &&
    Date.now() - candidate.completedAt <= migrationCompletionLifetime
  )
}

export function migrateWorkspaceToScope(
  workspaceId: string,
  scope: string
): void {
  const index = readIndex(workspaceId)
  if (!index) return

  const claimKey = StorageKeys.migrationClaim(workspaceId)
  const completionKey = StorageKeys.migrationCompletion(workspaceId)
  const existingClaim = readLocalPointer(claimKey, isValidClaim)
  if (existingClaim && existingClaim.scope !== scope) return

  const draftKeys = getPayloadKeys(workspaceId)
  const sourcePayloads = snapshotPayloads(workspaceId, draftKeys)
  const sourceArtifacts = snapshotSourceArtifacts(workspaceId)
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
    cleanupSourceIfCurrent(
      workspaceId,
      sourcePayloads,
      sourceArtifacts,
      claimKey,
      claim
    )
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
  const migrationArtifacts = snapshotMigrationArtifacts(
    workspaceId,
    scope,
    index,
    sourcePayloads,
    missingPointerKeys
  )

  const artifactsCopied =
    draftKeys.every((draftKey) =>
      copyPayload(
        draftKey,
        workspaceId,
        scope,
        sourcePayloads.get(draftKey) ?? null
      )
    ) &&
    missingPointerKeys.every((keyFor) =>
      copyRestorePointer(keyFor, workspaceId, scope)
    )
  const published =
    artifactsCopied && ownsClaim(claimKey, claim) && writeIndex(scope, index)
  const copied = published && ownsClaim(claimKey, claim)

  if (copied) {
    const completionRecorded = writeStorage(
      localStorage,
      completionKey,
      JSON.stringify({ ...claim, completedAt: Date.now() })
    )
    if (!completionRecorded) return
    cleanupSourceIfCurrent(
      workspaceId,
      sourcePayloads,
      sourceArtifacts,
      claimKey,
      claim
    )
  } else {
    const currentClaim = readLocalPointer(claimKey, isValidClaim)
    const completion = readLocalPointer(completionKey, isCurrentCompletion)
    const sameScopePeer =
      currentClaim?.scope === scope
        ? currentClaim.nonce !== claim.nonce
        : completion?.scope === scope &&
          completion.sourceUpdatedAt === claim.sourceUpdatedAt &&
          completion.nonce !== claim.nonce
    if (!sameScopePeer) {
      restoreStorageSnapshot(destinationSnapshot, migrationArtifacts)
    }
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
  sourcePayloads: Map<string, string | null>,
  sourceArtifacts: Map<string, string | null>,
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
    for (const [draftKey, sourceRaw] of sourcePayloads) {
      const key = payloadKey(workspaceId, draftKey)
      if (localStorage.getItem(key) === sourceRaw) localStorage.removeItem(key)
    }
    for (const [key, sourceRaw] of sourceArtifacts) {
      if (localStorage.getItem(key) === sourceRaw) localStorage.removeItem(key)
    }
  }
  releaseClaimIfOwned(claimKey, claim)
}

function snapshotScopeArtifacts(
  scope: string,
  draftKeys: string[],
  pointerKeys: ((scope: string) => string)[]
): Map<string, string | null> {
  const keys = [
    StorageKeys.draftIndex(scope),
    ...draftKeys.map((draftKey) => payloadKey(scope, draftKey)),
    ...pointerKeys.map((keyFor) => keyFor(scope))
  ]
  return new Map(keys.map((key) => [key, localStorage.getItem(key)]))
}

function snapshotPayloads(
  scope: string,
  draftKeys: string[]
): Map<string, string | null> {
  return new Map(
    draftKeys.map((draftKey) => [
      draftKey,
      localStorage.getItem(payloadKey(scope, draftKey))
    ])
  )
}

function snapshotSourceArtifacts(scope: string): Map<string, string | null> {
  const keys = [
    ...restorePointerKeys.map((keyFor) => keyFor(scope)),
    StorageKeys.draftIndex(scope)
  ]
  return new Map(keys.map((key) => [key, localStorage.getItem(key)]))
}

function snapshotMigrationArtifacts(
  workspaceId: string,
  scope: string,
  index: object,
  sourcePayloads: Map<string, string | null>,
  pointerKeys: ((scope: string) => string)[]
): Map<string, string | null> {
  const artifacts = new Map<string, string | null>([
    [StorageKeys.draftIndex(scope), JSON.stringify(index)]
  ])
  for (const [draftKey, raw] of sourcePayloads) {
    artifacts.set(payloadKey(scope, draftKey), raw)
  }
  for (const keyFor of pointerKeys) {
    const raw = localStorage.getItem(keyFor(workspaceId))
    if (raw === null) continue
    try {
      const pointer: unknown = JSON.parse(raw)
      if (typeof pointer === 'object' && pointer !== null) {
        artifacts.set(
          keyFor(scope),
          JSON.stringify({ ...pointer, workspaceId: scope })
        )
      }
    } catch {
      continue
    }
  }
  return artifacts
}

function payloadKey(scope: string, draftKey: string): string {
  return `${StorageKeys.prefixes.draftPayload}${scope}:${draftKey}`
}

function restoreStorageSnapshot(
  snapshot: Map<string, string | null>,
  migrationArtifacts: Map<string, string | null>
): void {
  for (const [key, value] of snapshot) {
    const current = localStorage.getItem(key)
    if (current !== value && current !== migrationArtifacts.get(key)) continue
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  }
}

function copyPayload(
  draftKey: string,
  workspaceId: string,
  scope: string,
  sourceRaw: string | null
): boolean {
  if (sourceRaw === null) return false
  const payload = readPayload(workspaceId, draftKey)
  if (
    !payload ||
    localStorage.getItem(payloadKey(workspaceId, draftKey)) !== sourceRaw
  )
    return false
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
