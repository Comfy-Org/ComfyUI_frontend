import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ISerialisedNode } from '@/lib/litegraph/src/litegraph'
import { LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { useTelemetry } from '@comfyorg/telemetry'

vi.mock(import('@comfyorg/telemetry'))

vi.mock(import('@/platform/workflowErrors/nodeReplacement/cnrIdUtil'), () => ({
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

describe('LGraphNode configure named values shadow diff', () => {
  let node: LGraphNode

  beforeEach(() => {
    node = new LGraphNode('TestNode')
    node.addWidget('number', 'steps', 0, null, {})
    node.addWidget('number', 'seed', 0, null, {})
  })

  afterEach(() => {
    LiteGraph.namedValuesRestore = false
  })

  it('applies legacy positional values when the flag is off', () => {
    LiteGraph.namedValuesRestore = false

    node.configure(mismatchInfo())

    expect(node.widgets!.map((w) => w.value)).toStrictEqual([30, 12345])
  })

  it('applies named values without crashing when the flag is on', () => {
    LiteGraph.namedValuesRestore = true

    expect(() => node.configure(mismatchInfo())).not.toThrow()

    expect(node.widgets!.map((w) => w.value)).toStrictEqual([15, 12345])
  })

  it('does not emit the retired per-node event for a mismatch', () => {
    LiteGraph.namedValuesRestore = true

    node.configure(mismatchInfo())

    expect(
      useTelemetry()?.trackNamedValuesShadowDiffMismatch
    ).not.toHaveBeenCalled()
  })
})
