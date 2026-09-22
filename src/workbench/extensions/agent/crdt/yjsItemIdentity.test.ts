/**
 * Contract test against the real library for the one place this codebase
 * reaches past Yjs's public `Y.Map` API into its internal `_map`/`Item.id`
 * storage. If a Yjs upgrade changes that internal shape, this file is where
 * it fails loudly.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'

import type { reportError as reportErrorFn } from '@/platform/telemetry/reportError'

const telemetryState = vi.hoisted(() => ({
  reportError: vi.fn<typeof reportErrorFn>()
}))

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: telemetryState.reportError
}))

import { readNodeItemIdentity, readYjsMapItemIdentity } from './yjsItemIdentity'

describe('readYjsMapItemIdentity', () => {
  it('returns null for a key that was never set', () => {
    const map = new Y.Doc().getMap('nodes')
    expect(readYjsMapItemIdentity(map, '1')).toBeNull()
  })

  it('returns a stable client:clock identity for a present entry', () => {
    const map = new Y.Doc().getMap('nodes')
    map.set('1', { type: 'KSampler' })
    const identity = readYjsMapItemIdentity(map, '1')
    expect(identity).toMatch(/^\d+:\d+$/)
    expect(readYjsMapItemIdentity(map, '1')).toBe(identity)
  })

  it('keeps returning the tombstoned identity right after delete', () => {
    const map = new Y.Doc().getMap('nodes')
    map.set('1', { type: 'KSampler' })
    const beforeDelete = readYjsMapItemIdentity(map, '1')
    map.delete('1')
    expect(readYjsMapItemIdentity(map, '1')).toBe(beforeDelete)
  })

  it('reports a different identity for a value recreated under the same key across separate transactions', () => {
    const map = new Y.Doc().getMap('nodes')
    map.set('1', { type: 'KSampler' })
    const original = readYjsMapItemIdentity(map, '1')
    map.delete('1')
    map.set('1', { type: 'SaveImage' })
    expect(readYjsMapItemIdentity(map, '1')).not.toBe(original)
  })

  it('reports a different identity for a delete-and-recreate inside one atomic transaction', () => {
    const doc = new Y.Doc()
    const map = doc.getMap('nodes')
    map.set('1', { type: 'KSampler' })
    const original = readYjsMapItemIdentity(map, '1')
    doc.transact(() => {
      map.delete('1')
      map.set('1', { type: 'SaveImage' })
    })
    expect(readYjsMapItemIdentity(map, '1')).not.toBe(original)
  })
})

describe('readNodeItemIdentity', () => {
  beforeEach(() => {
    telemetryState.reportError.mockClear()
  })

  it('reads the nodes map of a real Y.Doc', () => {
    const doc = new Y.Doc()
    doc.getMap('nodes').set('1', { type: 'KSampler' })
    expect(readNodeItemIdentity(doc, '1')).toMatch(/^\d+:\d+$/)
  })

  it('returns null without reporting for an id never set', () => {
    const doc = new Y.Doc()
    expect(readNodeItemIdentity(doc, '1')).toBeNull()
    expect(telemetryState.reportError).not.toHaveBeenCalled()
  })

  it('reports and returns null when the internal shape this module assumes is missing', () => {
    const doc = new Y.Doc()
    const nodes = doc.getMap('nodes')
    // Simulates a future Yjs internal-shape break without depending on one
    // actually existing today.
    Object.defineProperty(nodes, '_map', {
      get() {
        throw new Error('shape changed')
      }
    })
    expect(readNodeItemIdentity(doc, '1')).toBeNull()
    expect(telemetryState.reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        errorType: 'failure_reading_agent_crdt_node_item_identity'
      })
    )
  })
})
