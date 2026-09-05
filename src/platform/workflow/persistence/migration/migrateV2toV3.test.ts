import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DraftIndexV2 } from '../base/draftTypes'
import { hashPath } from '../base/hashUtil'
import { readIndex, readPayload } from '../base/storageIO'
import { hasV2DraftIndex, migrateV2toV3 } from './migrateV2toV3'

describe('migrateV2toV3', () => {
  const workspaceId = 'test-workspace'

  beforeEach(() => {
    localStorage.clear()
  })

  function setV2Data(
    entries: Array<{
      path: string
      data: string
      updatedAt?: number
      name?: string
      isTemporary?: boolean
    }>
  ) {
    const index: DraftIndexV2 = {
      v: 2,
      updatedAt: 3000,
      order: [],
      entries: {}
    }

    for (const item of entries) {
      const key = hashPath(item.path)
      index.order.push(key)
      index.entries[key] = {
        path: item.path,
        name: item.name ?? item.path,
        isTemporary: item.isTemporary ?? true,
        updatedAt: item.updatedAt ?? 1000
      }
      localStorage.setItem(
        `Comfy.Workflow.Draft.v2:${workspaceId}:${key}`,
        JSON.stringify({ data: item.data, updatedAt: item.updatedAt ?? 1000 })
      )
    }

    localStorage.setItem(
      `Comfy.Workflow.DraftIndex.v2:${workspaceId}`,
      JSON.stringify(index)
    )
  }

  it('migrates valid entries to full-path keys and path-bound payloads', () => {
    setV2Data([
      { path: 'workflows/a.json', data: '{"id":"a"}' },
      { path: 'workflows/b.json', data: '{"id":"b"}', updatedAt: 2000 }
    ])

    expect(migrateV2toV3(workspaceId)).toBe(2)

    expect(readIndex(workspaceId)?.order).toEqual([
      'workflows/a.json',
      'workflows/b.json'
    ])
    expect(readPayload(workspaceId, 'workflows/a.json')).toEqual({
      path: 'workflows/a.json',
      data: '{"id":"a"}',
      updatedAt: 1000
    })
    expect(readPayload(workspaceId, 'workflows/b.json')).toEqual({
      path: 'workflows/b.json',
      data: '{"id":"b"}',
      updatedAt: 2000
    })
    expect(
      localStorage.getItem(`Comfy.Workflow.DraftIndex.v2:${workspaceId}`)
    ).toBeNull()
  })

  it('restores only the canonical survivor of a known V2 collision', () => {
    setV2Data([{ path: 'workflows/4hbab.json', data: '{"id":"survivor"}' }])
    expect(hashPath('workflows/ewip.json')).toBe('684dbc71')
    expect(hashPath('workflows/4hbab.json')).toBe('684dbc71')

    expect(migrateV2toV3(workspaceId)).toBe(1)

    expect(readPayload(workspaceId, 'workflows/ewip.json')).toBeNull()
    expect(readPayload(workspaceId, 'workflows/4hbab.json')?.data).toBe(
      '{"id":"survivor"}'
    )
  })

  it('fails closed when a V2 key does not match its indexed path', () => {
    setV2Data([{ path: 'workflows/a.json', data: '{"id":"a"}' }])
    const rawIndex = localStorage.getItem(
      `Comfy.Workflow.DraftIndex.v2:${workspaceId}`
    )!
    const index = JSON.parse(rawIndex) as DraftIndexV2
    const [key] = index.order
    index.entries[key].path = 'workflows/b.json'
    localStorage.setItem(
      `Comfy.Workflow.DraftIndex.v2:${workspaceId}`,
      JSON.stringify(index)
    )
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(migrateV2toV3(workspaceId)).toBe(0)
    expect(readIndex(workspaceId)?.order).toEqual([])
    expect(readPayload(workspaceId, 'workflows/a.json')).toBeNull()
    expect(readPayload(workspaceId, 'workflows/b.json')).toBeNull()
  })

  it('skips entries whose payload is missing and keeps the rest', () => {
    setV2Data([
      { path: 'workflows/a.json', data: '{"id":"a"}' },
      { path: 'workflows/b.json', data: '{"id":"b"}' }
    ])
    localStorage.removeItem(
      `Comfy.Workflow.Draft.v2:${workspaceId}:${hashPath('workflows/a.json')}`
    )
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(migrateV2toV3(workspaceId)).toBe(1)
    expect(readIndex(workspaceId)?.order).toEqual(['workflows/b.json'])
    expect(readPayload(workspaceId, 'workflows/a.json')).toBeNull()
    expect(readPayload(workspaceId, 'workflows/b.json')?.data).toBe(
      '{"id":"b"}'
    )
    expect(
      localStorage.getItem(`Comfy.Workflow.DraftIndex.v2:${workspaceId}`)
    ).toBeNull()
  })

  it('skips order keys that have no index entry', () => {
    setV2Data([{ path: 'workflows/a.json', data: '{"id":"a"}' }])
    const indexKey = `Comfy.Workflow.DraftIndex.v2:${workspaceId}`
    const index = JSON.parse(localStorage.getItem(indexKey)!) as DraftIndexV2
    index.order.unshift('deadbeef')
    localStorage.setItem(indexKey, JSON.stringify(index))

    expect(migrateV2toV3(workspaceId)).toBe(1)
    expect(readIndex(workspaceId)?.order).toEqual(['workflows/a.json'])
    expect(readPayload(workspaceId, 'workflows/a.json')?.data).toBe(
      '{"id":"a"}'
    )
  })

  it('reports a V2 index key as present until it is migrated', () => {
    expect(hasV2DraftIndex(workspaceId)).toBe(false)
    setV2Data([{ path: 'workflows/a.json', data: '{"id":"a"}' }])
    expect(hasV2DraftIndex(workspaceId)).toBe(true)

    migrateV2toV3(workspaceId)
    expect(hasV2DraftIndex(workspaceId)).toBe(false)
  })
})
