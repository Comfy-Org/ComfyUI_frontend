/**
 * Contract test against the real library for the one place this codebase
 * reaches past Yjs's public `Y.Map` API into its internal `_map`/`Item.id`
 * storage. If a Yjs upgrade changes that internal shape, this file is where
 * it fails loudly.
 */
import { describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'

import type { reportError as reportErrorFn } from '@/platform/telemetry/reportError'

const telemetryState = vi.hoisted(() => ({
  reportError: vi.fn<typeof reportErrorFn>()
}))

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: telemetryState.reportError
}))

import { readNodeItemIdentity } from './yjsItemIdentity'

describe('readNodeItemIdentity', () => {
  it('returns null for a node id that was never set', () => {
    const doc = new Y.Doc()
    expect(readNodeItemIdentity(doc, '1')).toBeNull()
    expect(telemetryState.reportError).not.toHaveBeenCalled()
  })

  it('returns a stable client:clock identity for a present node', () => {
    const doc = new Y.Doc()
    doc.getMap('nodes').set('1', { type: 'KSampler' })
    const identity = readNodeItemIdentity(doc, '1')
    expect(identity).toMatch(/^\d+:\d+$/)
    expect(readNodeItemIdentity(doc, '1')).toBe(identity)
  })

  it('keeps returning the tombstoned identity right after delete', () => {
    const doc = new Y.Doc()
    doc.getMap('nodes').set('1', { type: 'KSampler' })
    const beforeDelete = readNodeItemIdentity(doc, '1')
    doc.getMap('nodes').delete('1')
    expect(readNodeItemIdentity(doc, '1')).toBe(beforeDelete)
  })

  it('reports a different identity for a value recreated under the same node id across separate transactions', () => {
    const doc = new Y.Doc()
    doc.getMap('nodes').set('1', { type: 'KSampler' })
    const original = readNodeItemIdentity(doc, '1')
    doc.getMap('nodes').delete('1')
    doc.getMap('nodes').set('1', { type: 'SaveImage' })
    expect(readNodeItemIdentity(doc, '1')).not.toBe(original)
  })

  it('reports a different identity for a delete-and-recreate inside one atomic transaction', () => {
    const doc = new Y.Doc()
    doc.getMap('nodes').set('1', { type: 'KSampler' })
    const original = readNodeItemIdentity(doc, '1')
    doc.transact(() => {
      const nodes = doc.getMap('nodes')
      nodes.delete('1')
      nodes.set('1', { type: 'SaveImage' })
    })
    expect(readNodeItemIdentity(doc, '1')).not.toBe(original)
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
