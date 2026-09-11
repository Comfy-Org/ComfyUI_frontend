import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DraftIndexV2 } from '../base/draftTypes'
import { hashPath } from '../base/hashUtil'
import { StorageKeys } from '../base/storageKeys'
import { migrateWorkspaceToScope } from './migrateWorkspaceToScope'

const sourceWorkspaceId = 'workspace-a'
const destinationScope = 'user-a:workspace-a'
const competingScope = 'user-b:workspace-a'
const draftPath = 'workflows/one.json'
const draftKey = hashPath(draftPath)

function buildIndex(): DraftIndexV2 {
  return {
    v: 2,
    updatedAt: 10,
    order: [draftKey],
    entries: {
      [draftKey]: {
        path: draftPath,
        name: 'one',
        isTemporary: false,
        updatedAt: 10
      }
    }
  }
}

function seedSourceWorkspace() {
  localStorage.setItem(
    StorageKeys.draftIndex(sourceWorkspaceId),
    JSON.stringify(buildIndex())
  )
  localStorage.setItem(
    StorageKeys.draftPayload(draftPath, sourceWorkspaceId),
    JSON.stringify({ data: '{"nodes":[]}', updatedAt: 10 })
  )
  localStorage.setItem(
    StorageKeys.lastActivePath(sourceWorkspaceId),
    JSON.stringify({ workspaceId: sourceWorkspaceId, path: draftPath })
  )
  localStorage.setItem(
    StorageKeys.lastOpenPaths(sourceWorkspaceId),
    JSON.stringify({
      workspaceId: sourceWorkspaceId,
      paths: [draftPath],
      activeIndex: 0
    })
  )
}

function readJson(key: string): unknown {
  const json = localStorage.getItem(key)
  return json === null ? null : JSON.parse(json)
}

describe('migrateWorkspaceToScope', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('moves drafts and restore pointers into the scope and removes the workspace copy', () => {
    seedSourceWorkspace()

    migrateWorkspaceToScope(sourceWorkspaceId, destinationScope)

    expect(readJson(StorageKeys.draftIndex(destinationScope))).toEqual(
      buildIndex()
    )
    expect(
      readJson(StorageKeys.draftPayload(draftPath, destinationScope))
    ).toEqual({ data: '{"nodes":[]}', updatedAt: 10 })
    expect(readJson(StorageKeys.lastActivePath(destinationScope))).toEqual({
      workspaceId: destinationScope,
      path: draftPath
    })
    expect(readJson(StorageKeys.lastOpenPaths(destinationScope))).toEqual({
      workspaceId: destinationScope,
      paths: [draftPath],
      activeIndex: 0
    })

    expect(
      localStorage.getItem(StorageKeys.draftIndex(sourceWorkspaceId))
    ).toBe(null)
    expect(
      localStorage.getItem(
        StorageKeys.draftPayload(draftPath, sourceWorkspaceId)
      )
    ).toBe(null)
    expect(
      localStorage.getItem(StorageKeys.lastActivePath(sourceWorkspaceId))
    ).toBe(null)
    expect(
      localStorage.getItem(StorageKeys.lastOpenPaths(sourceWorkspaceId))
    ).toBe(null)
  })

  it('finishes the source cleanup when the destination is already committed', () => {
    seedSourceWorkspace()
    const destinationIndex: DraftIndexV2 = {
      v: 2,
      updatedAt: 99,
      order: [],
      entries: {}
    }
    localStorage.setItem(
      StorageKeys.draftIndex(destinationScope),
      JSON.stringify(destinationIndex)
    )
    localStorage.setItem(
      StorageKeys.migrationClaim(sourceWorkspaceId),
      JSON.stringify({ scope: destinationScope, sourceUpdatedAt: 10 })
    )

    migrateWorkspaceToScope(sourceWorkspaceId, destinationScope)

    expect(readJson(StorageKeys.draftIndex(destinationScope))).toEqual(
      destinationIndex
    )
    expect(
      localStorage.getItem(
        StorageKeys.draftPayload(draftPath, destinationScope)
      )
    ).toBe(null)
    expect(
      localStorage.getItem(StorageKeys.draftIndex(sourceWorkspaceId))
    ).toBe(null)
    expect(
      localStorage.getItem(
        StorageKeys.draftPayload(draftPath, sourceWorkspaceId)
      )
    ).toBe(null)
    expect(
      localStorage.getItem(StorageKeys.lastActivePath(sourceWorkspaceId))
    ).toBe(null)
    expect(
      localStorage.getItem(StorageKeys.lastOpenPaths(sourceWorkspaceId))
    ).toBe(null)
    expect(
      localStorage.getItem(StorageKeys.migrationClaim(sourceWorkspaceId))
    ).toBe(null)
  })

  it('leaves a committed destination alone when there is no source to clean up', () => {
    const destinationIndex: DraftIndexV2 = {
      v: 2,
      updatedAt: 99,
      order: [],
      entries: {}
    }
    localStorage.setItem(
      StorageKeys.draftIndex(destinationScope),
      JSON.stringify(destinationIndex)
    )
    localStorage.setItem(
      StorageKeys.draftPayload(draftPath, sourceWorkspaceId),
      JSON.stringify({ data: '{}', updatedAt: 1 })
    )

    migrateWorkspaceToScope(sourceWorkspaceId, destinationScope)

    expect(readJson(StorageKeys.draftIndex(destinationScope))).toEqual(
      destinationIndex
    )
    expect(
      localStorage.getItem(
        StorageKeys.draftPayload(draftPath, sourceWorkspaceId)
      )
    ).not.toBe(null)
  })

  it('does nothing when the workspace has no draft index', () => {
    localStorage.setItem(
      StorageKeys.draftPayload(draftPath, sourceWorkspaceId),
      JSON.stringify({ data: '{}', updatedAt: 1 })
    )

    migrateWorkspaceToScope(sourceWorkspaceId, destinationScope)

    expect(localStorage.getItem(StorageKeys.draftIndex(destinationScope))).toBe(
      null
    )
    expect(
      localStorage.getItem(
        StorageKeys.draftPayload(draftPath, destinationScope)
      )
    ).toBe(null)
    expect(
      localStorage.getItem(
        StorageKeys.draftPayload(draftPath, sourceWorkspaceId)
      )
    ).not.toBe(null)
  })

  it('keeps the workspace copy and writes no scoped index when a payload copy hits the quota', () => {
    seedSourceWorkspace()
    const destinationPayloadKey = StorageKeys.draftPayload(
      draftPath,
      destinationScope
    )
    const realSetItem = localStorage.setItem.bind(localStorage)
    vi.spyOn(localStorage, 'setItem').mockImplementation(
      (key: string, value: string) => {
        if (key === destinationPayloadKey) {
          throw new DOMException('Quota exceeded', 'QuotaExceededError')
        }
        realSetItem(key, value)
      }
    )

    migrateWorkspaceToScope(sourceWorkspaceId, destinationScope)

    expect(localStorage.getItem(StorageKeys.draftIndex(destinationScope))).toBe(
      null
    )
    expect(readJson(StorageKeys.draftIndex(sourceWorkspaceId))).toEqual(
      buildIndex()
    )
    expect(
      readJson(StorageKeys.draftPayload(draftPath, sourceWorkspaceId))
    ).toEqual({ data: '{"nodes":[]}', updatedAt: 10 })
    expect(readJson(StorageKeys.lastActivePath(sourceWorkspaceId))).not.toBe(
      null
    )
  })

  it('removes every copied destination artifact when a restore pointer copy hits the quota', () => {
    seedSourceWorkspace()
    const failingKey = StorageKeys.lastOpenPaths(destinationScope)
    const realSetItem = localStorage.setItem.bind(localStorage)
    vi.spyOn(localStorage, 'setItem').mockImplementation(
      (key: string, value: string) => {
        if (key === failingKey) {
          throw new DOMException('Quota exceeded', 'QuotaExceededError')
        }
        realSetItem(key, value)
      }
    )

    migrateWorkspaceToScope(sourceWorkspaceId, destinationScope)

    expect(localStorage.getItem(StorageKeys.draftIndex(destinationScope))).toBe(
      null
    )
    expect(
      localStorage.getItem(
        StorageKeys.draftPayload(draftPath, destinationScope)
      )
    ).toBe(null)
    expect(
      localStorage.getItem(StorageKeys.lastActivePath(destinationScope))
    ).toBe(null)
    expect(readJson(StorageKeys.draftIndex(sourceWorkspaceId))).toEqual(
      buildIndex()
    )
    expect(readJson(StorageKeys.lastActivePath(sourceWorkspaceId))).toEqual({
      workspaceId: sourceWorkspaceId,
      path: draftPath
    })
  })

  it('keeps a restore pointer the scope already owns and still copies the missing one', () => {
    seedSourceWorkspace()
    const existingPointer = {
      workspaceId: destinationScope,
      path: 'workflows/existing.json'
    }
    localStorage.setItem(
      StorageKeys.lastActivePath(destinationScope),
      JSON.stringify(existingPointer)
    )

    migrateWorkspaceToScope(sourceWorkspaceId, destinationScope)

    expect(readJson(StorageKeys.lastActivePath(destinationScope))).toEqual(
      existingPointer
    )
    expect(readJson(StorageKeys.lastOpenPaths(destinationScope))).toEqual({
      workspaceId: destinationScope,
      paths: [draftPath],
      activeIndex: 0
    })
    expect(readJson(StorageKeys.draftIndex(destinationScope))).toEqual(
      buildIndex()
    )
    expect(
      localStorage.getItem(StorageKeys.draftIndex(sourceWorkspaceId))
    ).toBe(null)
    expect(
      localStorage.getItem(StorageKeys.lastActivePath(sourceWorkspaceId))
    ).toBe(null)
    expect(
      localStorage.getItem(StorageKeys.lastOpenPaths(sourceWorkspaceId))
    ).toBe(null)
  })

  it('leaves a pre-existing scope restore pointer untouched when the copy rolls back', () => {
    seedSourceWorkspace()
    const existingPointer = {
      workspaceId: destinationScope,
      path: 'workflows/existing.json'
    }
    localStorage.setItem(
      StorageKeys.lastActivePath(destinationScope),
      JSON.stringify(existingPointer)
    )
    const failingKey = StorageKeys.lastOpenPaths(destinationScope)
    const realSetItem = localStorage.setItem.bind(localStorage)
    vi.spyOn(localStorage, 'setItem').mockImplementation(
      (key: string, value: string) => {
        if (key === failingKey) {
          throw new DOMException('Quota exceeded', 'QuotaExceededError')
        }
        realSetItem(key, value)
      }
    )

    migrateWorkspaceToScope(sourceWorkspaceId, destinationScope)

    expect(readJson(StorageKeys.lastActivePath(destinationScope))).toEqual(
      existingPointer
    )
    expect(localStorage.getItem(StorageKeys.draftIndex(destinationScope))).toBe(
      null
    )
    expect(
      localStorage.getItem(
        StorageKeys.draftPayload(draftPath, destinationScope)
      )
    ).toBe(null)
    expect(readJson(StorageKeys.draftIndex(sourceWorkspaceId))).toEqual(
      buildIndex()
    )
    expect(readJson(StorageKeys.lastOpenPaths(sourceWorkspaceId))).toEqual({
      workspaceId: sourceWorkspaceId,
      paths: [draftPath],
      activeIndex: 0
    })
  })

  it('preserves the workspace when another scope holds the migration claim', () => {
    seedSourceWorkspace()
    localStorage.setItem(
      StorageKeys.migrationClaim(sourceWorkspaceId),
      JSON.stringify({
        scope: 'user-b:workspace-a',
        sourceUpdatedAt: 10
      })
    )

    migrateWorkspaceToScope(sourceWorkspaceId, destinationScope)

    expect(localStorage.getItem(StorageKeys.draftIndex(destinationScope))).toBe(
      null
    )
    expect(readJson(StorageKeys.draftIndex(sourceWorkspaceId))).toEqual(
      buildIndex()
    )
  })

  it('allows only the winning identity to commit when another tab overwrites the claim', () => {
    seedSourceWorkspace()
    const claimKey = StorageKeys.migrationClaim(sourceWorkspaceId)
    const destinationPayloadKey = StorageKeys.draftPayload(
      draftPath,
      destinationScope
    )
    const realSetItem = localStorage.setItem.bind(localStorage)
    let replacedClaim = false
    vi.spyOn(localStorage, 'setItem').mockImplementation(
      (key: string, value: string) => {
        realSetItem(key, value)
        if (key === destinationPayloadKey && !replacedClaim) {
          replacedClaim = true
          realSetItem(
            claimKey,
            JSON.stringify({
              scope: competingScope,
              sourceUpdatedAt: 10,
              nonce: 'competing-tab'
            })
          )
          migrateWorkspaceToScope(sourceWorkspaceId, competingScope)
        }
      }
    )

    migrateWorkspaceToScope(sourceWorkspaceId, destinationScope)

    expect(readJson(StorageKeys.draftIndex(competingScope))).toEqual(
      buildIndex()
    )
    expect(readJson(StorageKeys.draftIndex(destinationScope))).toBe(null)
    expect(readJson(StorageKeys.draftIndex(sourceWorkspaceId))).toBe(null)
  })

  it('preserves a newer source generation written while committing the destination index', () => {
    seedSourceWorkspace()
    const sourceIndexKey = StorageKeys.draftIndex(sourceWorkspaceId)
    const destinationIndexKey = StorageKeys.draftIndex(destinationScope)
    const newerIndex = { ...buildIndex(), updatedAt: 20 }
    const realSetItem = localStorage.setItem.bind(localStorage)
    const setItemSpy = vi
      .spyOn(localStorage, 'setItem')
      .mockImplementation((key: string, value: string) => {
        realSetItem(key, value)
        if (key === destinationIndexKey) {
          realSetItem(sourceIndexKey, JSON.stringify(newerIndex))
        }
      })

    migrateWorkspaceToScope(sourceWorkspaceId, destinationScope)

    expect(readJson(sourceIndexKey)).toEqual(newerIndex)
    expect(readJson(destinationIndexKey)).toEqual(buildIndex())
    expect(
      readJson(StorageKeys.draftPayload(draftPath, sourceWorkspaceId))
    ).toEqual({ data: '{"nodes":[]}', updatedAt: 10 })

    setItemSpy.mockRestore()
    migrateWorkspaceToScope(sourceWorkspaceId, destinationScope)

    expect(readJson(sourceIndexKey)).toBe(null)
    expect(readJson(destinationIndexKey)).toEqual(newerIndex)
  })

  it('preserves a newer workspace when the committed destination claim is stale', () => {
    seedSourceWorkspace()
    localStorage.setItem(
      StorageKeys.draftIndex(destinationScope),
      JSON.stringify(buildIndex())
    )
    localStorage.setItem(
      StorageKeys.migrationClaim(sourceWorkspaceId),
      JSON.stringify({ scope: destinationScope, sourceUpdatedAt: 5 })
    )

    migrateWorkspaceToScope(sourceWorkspaceId, destinationScope)

    expect(readJson(StorageKeys.draftIndex(sourceWorkspaceId))).toEqual(
      buildIndex()
    )
  })

  it('preserves the workspace when the destination has no migration claim', () => {
    seedSourceWorkspace()
    localStorage.setItem(
      StorageKeys.draftIndex(destinationScope),
      JSON.stringify(buildIndex())
    )

    migrateWorkspaceToScope(sourceWorkspaceId, destinationScope)

    expect(readJson(StorageKeys.draftIndex(sourceWorkspaceId))).toEqual(
      buildIndex()
    )
  })

  it('removes the migration claim after a successful migration', () => {
    seedSourceWorkspace()

    migrateWorkspaceToScope(sourceWorkspaceId, destinationScope)

    expect(
      localStorage.getItem(StorageKeys.migrationClaim(sourceWorkspaceId))
    ).toBe(null)
  })
})
