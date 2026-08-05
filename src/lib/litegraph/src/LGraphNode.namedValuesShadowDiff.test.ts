import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ISerialisedNode } from '@/lib/litegraph/src/litegraph'
import { LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'

const trackNamedValuesShadowDiffMismatch = vi.fn()
const trackNamedValuesShadowDiffSummary = vi.fn()

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({
    trackNamedValuesShadowDiffMismatch,
    trackNamedValuesShadowDiffSummary
  })
}))

vi.mock('@/platform/nodeReplacement/cnrIdUtil', () => ({
  getCnrIdFromNode: () => undefined
}))

function mismatchInfo(): ISerialisedNode {
  return {
    id: 1,
    type: 'TestNode',
    pos: [0, 0],
    size: [200, 100],
    flags: {},
    order: 0,
    mode: 0,
    widgets_values: [30, 12345],
    widgets_values_named: { steps: 15, seed: 12345 }
  }
}

function agreeingInfo(): ISerialisedNode {
  return {
    id: 1,
    type: 'TestNode',
    pos: [0, 0],
    size: [200, 100],
    flags: {},
    order: 0,
    mode: 0,
    widgets_values: [30, 12345],
    widgets_values_named: { steps: 30, seed: 12345 }
  }
}

describe('LGraphNode configure named values shadow diff', () => {
  let node: LGraphNode

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    trackNamedValuesShadowDiffMismatch.mockClear()
    trackNamedValuesShadowDiffSummary.mockClear()
    node = new LGraphNode('TestNode')
    node.addWidget('number', 'steps', 0, null, {})
    node.addWidget('number', 'seed', 0, null, {})
  })

  afterEach(() => {
    LiteGraph.namedValuesRestore = false
  })

  it('applies legacy positional values and still reports the shadow mismatch when the flag is off', () => {
    LiteGraph.namedValuesRestore = false

    node.configure(mismatchInfo())

    expect(node.widgets!.map((w) => w.value)).toStrictEqual([30, 12345])
    expect(trackNamedValuesShadowDiffMismatch).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        mismatch_widget_count: 1,
        checked_widget_count: 2
      })
    )
  })

  it('applies named values and reports the shadow mismatch without crashing when the flag is on', () => {
    LiteGraph.namedValuesRestore = true

    expect(() => node.configure(mismatchInfo())).not.toThrow()

    expect(node.widgets!.map((w) => w.value)).toStrictEqual([15, 12345])
    expect(trackNamedValuesShadowDiffMismatch).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        mismatch_widget_count: 1,
        checked_widget_count: 2
      })
    )
  })

  it('does not fire the mismatch event when named and legacy values agree', () => {
    LiteGraph.namedValuesRestore = true

    node.configure(agreeingInfo())

    expect(trackNamedValuesShadowDiffMismatch).not.toHaveBeenCalled()
  })

  it('reports has_on_serialize_hook and has_on_configure_hook as false with no hooks set', () => {
    LiteGraph.namedValuesRestore = true

    node.configure(mismatchInfo())

    expect(trackNamedValuesShadowDiffMismatch).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        has_on_serialize_hook: false,
        has_on_configure_hook: false
      })
    )
  })

  it('reports has_on_serialize_hook and has_on_configure_hook as true when set', () => {
    LiteGraph.namedValuesRestore = true
    node.onSerialize = () => {}
    node.onConfigure = () => {}

    node.configure(mismatchInfo())

    expect(trackNamedValuesShadowDiffMismatch).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        has_on_serialize_hook: true,
        has_on_configure_hook: true
      })
    )
  })
})
