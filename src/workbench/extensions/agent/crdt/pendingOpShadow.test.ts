import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import type {
  PendingShadow,
  ShadowChange,
  ShadowTarget
} from './pendingOpShadow'
import { createPendingOpShadowSurface } from './pendingOpShadow'

const node = (nodeId: string): ShadowTarget => ({ kind: 'node', nodeId })
const link = (linkId: string): ShadowTarget => ({ kind: 'link', linkId })
const widget = (nodeId: string, widgetName: string): ShadowTarget => ({
  kind: 'widget',
  nodeId,
  widgetName
})

describe('pendingOpShadow (s3-opt-5 presentation surface)', () => {
  it('shows a shadow exactly once per op id and never overwrites', () => {
    const surface = createPendingOpShadowSurface()
    expect(surface.show('op-1', [node('n1')])).toBe(true)
    expect(surface.show('op-1', [node('n2')])).toBe(false)
    expect(surface.get('op-1')?.targets).toEqual([node('n1')])
    expect(surface.size()).toBe(1)
  })

  it('tracks node, link, and widget targets for one op', () => {
    const surface = createPendingOpShadowSurface()
    surface.show('op-1', [node('n1'), link('l1'), widget('n1', 'seed')])
    expect(surface.isPending(node('n1'))).toBe(true)
    expect(surface.isPending(link('l1'))).toBe(true)
    expect(surface.isPending(widget('n1', 'seed'))).toBe(true)
    expect(surface.isPending(widget('n1', 'steps'))).toBe(false)
    expect(surface.isPending(node('n2'))).toBe(false)
  })

  it('revert removes the shadow and returns it; unknown id is a no-op', () => {
    const surface = createPendingOpShadowSurface()
    surface.show('op-1', [node('n1')])
    const removed = surface.revert('op-1')
    expect(removed?.opId).toBe('op-1')
    expect(surface.get('op-1')).toBeUndefined()
    expect(surface.isPending(node('n1'))).toBe(false)
    expect(surface.revert('op-1')).toBeUndefined()
    expect(surface.revert('never-shown')).toBeUndefined()
  })

  it('clear removes the shadow on effect (KA-9) and returns it', () => {
    const surface = createPendingOpShadowSurface()
    surface.show('op-1', [widget('n1', 'seed')])
    const removed = surface.clear('op-1')
    expect(removed?.targets).toEqual([widget('n1', 'seed')])
    expect(surface.isPending(widget('n1', 'seed'))).toBe(false)
    expect(surface.clear('op-1')).toBeUndefined()
  })

  it('refcounts a target shared by two ops across revert and clear', () => {
    const surface = createPendingOpShadowSurface()
    surface.show('op-1', [node('n1')])
    surface.show('op-2', [node('n1'), node('n2')])
    expect(surface.isPending(node('n1'))).toBe(true)

    surface.revert('op-1')
    expect(surface.isPending(node('n1'))).toBe(true)
    expect(surface.isPending(node('n2'))).toBe(true)

    surface.clear('op-2')
    expect(surface.isPending(node('n1'))).toBe(false)
    expect(surface.isPending(node('n2'))).toBe(false)
  })

  it('deduplicates shared targets in pendingTargets()', () => {
    const surface = createPendingOpShadowSurface()
    surface.show('op-1', [node('n1'), link('l1')])
    surface.show('op-2', [node('n1')])
    expect(surface.pendingTargets()).toEqual([node('n1'), link('l1')])
  })

  it('clearAll drops every shadow in insertion order (FEB-5)', () => {
    const surface = createPendingOpShadowSurface()
    surface.show('op-1', [node('n1')])
    surface.show('op-2', [link('l1')])
    const removed = surface.clearAll()
    expect(removed.map((s: PendingShadow) => s.opId)).toEqual(['op-1', 'op-2'])
    expect(surface.size()).toBe(0)
    expect(surface.pendingTargets()).toEqual([])
    expect(surface.isPending(node('n1'))).toBe(false)
    expect(surface.clearAll()).toEqual([])
  })

  it('notifies subscribers with the distinct verb per mutation', () => {
    const surface = createPendingOpShadowSurface()
    const changes: ShadowChange[] = []
    const unsubscribe = surface.subscribe((change) => changes.push(change))

    surface.show('op-1', [node('n1')])
    surface.show('op-2', [node('n2')])
    surface.revert('op-1')
    surface.clear('op-2')
    surface.show('op-3', [node('n3')])
    surface.clearAll()

    expect(changes).toEqual([
      { type: 'show', opId: 'op-1' },
      { type: 'show', opId: 'op-2' },
      { type: 'revert', opId: 'op-1' },
      { type: 'clear', opId: 'op-2' },
      { type: 'show', opId: 'op-3' },
      { type: 'clear-all', opIds: ['op-3'] }
    ])

    unsubscribe()
    surface.show('op-4', [node('n4')])
    expect(changes).toHaveLength(6)
  })

  it('does not notify on rejected or no-op mutations', () => {
    const surface = createPendingOpShadowSurface()
    const changes: ShadowChange[] = []
    surface.subscribe((change) => changes.push(change))

    surface.revert('unknown')
    surface.clear('unknown')
    surface.clearAll()
    surface.show('op-1', [node('n1')])
    surface.show('op-1', [node('n1')])

    expect(changes).toEqual([{ type: 'show', opId: 'op-1' }])
  })

  it('snapshots are decoupled from caller input and internal state', () => {
    const surface = createPendingOpShadowSurface()
    const input = [node('n1')]
    surface.show('op-1', input)
    input.push(node('n2'))
    expect(surface.get('op-1')?.targets).toEqual([node('n1')])

    const shadow = surface.get('op-1')
    expect(shadow && Object.isFrozen(shadow)).toBe(true)
    expect(shadow && Object.isFrozen(shadow.targets)).toBe(true)

    const listed = surface.pendingShadows()
    listed.pop()
    expect(surface.pendingShadows()).toHaveLength(1)
  })

  it('never touches Yjs or the shared doc: the module has zero imports', () => {
    // FORECLOSE #5 guard: the overlay must stay presentation-only. Importing
    // yjs (or anything else) from this module would be the first step toward
    // encoding shadows into the shared doc, so pin the import surface itself.
    const source = readFileSync(
      'src/workbench/extensions/agent/crdt/pendingOpShadow.ts',
      'utf8'
    )
    expect(source).not.toMatch(/^\s*import /m)
    expect(source).not.toMatch(/from 'yjs'/)
  })
})
