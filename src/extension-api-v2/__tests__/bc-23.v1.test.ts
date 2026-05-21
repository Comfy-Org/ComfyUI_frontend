// Category: BC.23 — Node property bag mutations
// DB cross-ref: S2.N18
// blast_radius: 4.67 (compat-floor)
// v1 contract: LGraphNode.prototype.onPropertyChanged?(name, value, prev_value): boolean
//              - Triggered by node.setProperty(name, value) — NOT by direct
//                property-bag mutation.
//              - Receives (name, value, prev_value); prev_value is undefined
//                on the first set for that key.
//              - Returning literal `false` rolls back the change
//                (cancellation semantics, see LGraphNode.ts §setProperty).
//              - Short-circuits when value === current (no callback fired).
//              - Side effect: setProperty also syncs widget.value for the
//                first widget whose options.property matches name.
// TODO(R8): swap with loadEvidenceSnippet once excerpts populated.
//
// W15.J (TC-2): Promote synthetic object-literal coverage to seven real-body
// tests that exercise the actual LGraphNode + setProperty path. v1 only — no
// dependency on World / ECS dispatch.

import { describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

import { countEvidenceExcerpts, loadEvidenceSnippet, runV1 } from '../harness'

void [loadEvidenceSnippet, runV1]

describe('BC.23 v1 contract — LGraphNode.onPropertyChanged via setProperty (S2.N18)', () => {
  it.skip('S2.N18 has at least one evidence excerpt — TODO(R8): harness snapshot does not yet include S2.N18 excerpts', () => {
    expect(countEvidenceExcerpts('S2.N18')).toBeGreaterThan(0)
  })

  it('setProperty invokes onPropertyChanged with (name, value, undefined) on the first set', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    graph.add(node)

    const spy = vi.fn()
    node.onPropertyChanged = spy

    node.setProperty('seed', 42)

    expect(spy).toHaveBeenCalledOnce()
    expect(spy).toHaveBeenCalledWith('seed', 42, undefined)
    expect(node.properties['seed']).toBe(42)
  })

  it('setProperty invokes onPropertyChanged with prev_value on a subsequent set', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    graph.add(node)

    const spy = vi.fn()
    node.onPropertyChanged = spy

    node.setProperty('seed', 1)
    node.setProperty('seed', 2)

    expect(spy).toHaveBeenCalledTimes(2)
    expect(spy.mock.calls[0]).toEqual(['seed', 1, undefined])
    expect(spy.mock.calls[1]).toEqual(['seed', 2, 1])
    expect(node.properties['seed']).toBe(2)
  })

  it('setProperty short-circuits when value === current — onPropertyChanged is NOT called again', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    graph.add(node)

    const spy = vi.fn()
    node.onPropertyChanged = spy

    node.setProperty('seed', 42)
    node.setProperty('seed', 42) // identical — skipped
    node.setProperty('seed', 42) // identical — skipped

    expect(spy).toHaveBeenCalledOnce()
    expect(spy).toHaveBeenCalledWith('seed', 42, undefined)
  })

  it('onPropertyChanged returning false rolls back the mutation (cancellation semantics)', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    graph.add(node)

    // Seed the bag so we have a real prev_value to roll back to.
    node.setProperty('seed', 1)

    // Now veto the next change.
    node.onPropertyChanged = vi.fn(() => false)

    node.setProperty('seed', 999)

    expect(node.onPropertyChanged).toHaveBeenCalledWith('seed', 999, 1)
    expect(node.properties['seed']).toBe(1) // rolled back to prev_value
  })

  it('onPropertyChanged returning a non-false value preserves the mutation', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    graph.add(node)

    // Vitest's vi.fn() defaults to returning undefined — only literal `false`
    // rolls back per setProperty source. Cover undefined + true explicitly.
    const undefSpy = vi.fn()
    node.onPropertyChanged = undefSpy
    node.setProperty('alpha', 'a')
    expect(node.properties['alpha']).toBe('a')

    const trueSpy = vi.fn(() => true)
    node.onPropertyChanged = trueSpy
    node.setProperty('beta', 'b')
    expect(node.properties['beta']).toBe('b')
  })

  it('direct mutation of node.properties bypasses onPropertyChanged (no observer fired)', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    graph.add(node)

    const spy = vi.fn()
    node.onPropertyChanged = spy

    // Direct bag mutation — NOT a setProperty call.
    node.properties['seed'] = 42
    node.properties['sampler_name'] = 'euler'

    expect(spy).not.toHaveBeenCalled()
    expect(node.properties['seed']).toBe(42)
    expect(node.properties['sampler_name']).toBe('euler')
  })

  it('setProperty syncs the value of the first widget whose options.property matches name', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    graph.add(node)

    // Minimal widget shape — only options.property + value are consulted by
    // setProperty's widget-sync loop (see LGraphNode.ts §setProperty).
    const matchingWidget = {
      name: 'seed',
      type: 'number',
      value: 0,
      options: { property: 'seed' }
    } as unknown as IBaseWidget

    const unrelatedWidget = {
      name: 'steps',
      type: 'number',
      value: 20,
      options: { property: 'steps' }
    } as unknown as IBaseWidget

    node.widgets = [matchingWidget, unrelatedWidget]

    node.setProperty('seed', 1234)

    expect(node.properties['seed']).toBe(1234)
    expect(matchingWidget.value).toBe(1234) // synced
    expect(unrelatedWidget.value).toBe(20) // untouched
  })
})
