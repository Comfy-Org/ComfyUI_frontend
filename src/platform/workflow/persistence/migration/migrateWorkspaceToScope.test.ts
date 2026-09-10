import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DraftIndexV2 } from '../base/draftTypes'
import { hashPath } from '../base/hashUtil'
import { StorageKeys } from '../base/storageKeys'
import { migrateWorkspaceToScope } from './migrateWorkspaceToScope'

const sourceWorkspaceId = 'workspace-a'
const destinationScope = 'user-a:workspace-a'
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
    vi.resetModules()
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
})
