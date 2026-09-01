import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '../LGraphNode'
import type { NamedValuesShadowDiffResult } from './namedValuesShadowDiff'
import {
  beginNamedValuesShadowDiffLoad,
  endNamedValuesShadowDiffLoad,
  reportNamedValuesShadowDiff
} from './namedValuesShadowDiffTelemetry'

const trackNamedValuesShadowDiffMismatch = vi.fn()
const trackNamedValuesShadowDiffSummary = vi.fn()
const getCnrIdFromNode = vi.fn<(node: unknown) => string | undefined>()

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({
    trackNamedValuesShadowDiffMismatch,
    trackNamedValuesShadowDiffSummary
  })
}))

vi.mock('@/platform/nodeReplacement/cnrIdUtil', () => ({
  getCnrIdFromNode: (node: unknown) => getCnrIdFromNode(node)
}))

type NodeHooks = Partial<Pick<LGraphNode, 'onSerialize' | 'onConfigure'>>

function fakeNode(className: string, hooks: NodeHooks = {}): LGraphNode {
  class FakeNode {}
  Object.defineProperty(FakeNode, 'name', { value: className })
  return Object.assign(new FakeNode(), hooks) as unknown as LGraphNode
}

describe('reportNamedValuesShadowDiff', () => {
  beforeEach(() => {
    getCnrIdFromNode.mockReset().mockReturnValue(undefined)
  })

  it('does nothing when there is no diff to report', () => {
    reportNamedValuesShadowDiff(fakeNode('KSampler'), null, true)
    expect(trackNamedValuesShadowDiffMismatch).not.toHaveBeenCalled()
  })

  it('does not fire when there is no mismatch', () => {
    const diff: NamedValuesShadowDiffResult = {
      mismatchWidgetCount: 0,
      checkedWidgetCount: 3
    }
    reportNamedValuesShadowDiff(fakeNode('KSampler'), diff, true)
    expect(trackNamedValuesShadowDiffMismatch).not.toHaveBeenCalled()
  })

  it('fires with the expected fields on a mismatch', () => {
    getCnrIdFromNode.mockReturnValue('comfy-core')
    const diff: NamedValuesShadowDiffResult = {
      mismatchWidgetCount: 2,
      checkedWidgetCount: 3
    }
    const node = fakeNode('KSampler', {
      onSerialize: () => {},
      onConfigure: undefined
    })
    reportNamedValuesShadowDiff(node, diff, true)

    expect(trackNamedValuesShadowDiffMismatch).toHaveBeenCalledExactlyOnceWith({
      node_type: 'KSampler',
      pack_id: 'comfy-core',
      mismatch_widget_count: 2,
      checked_widget_count: 3,
      had_named_field: true,
      has_on_serialize_hook: true,
      has_on_configure_hook: false
    })
  })

  it('reflects had_named_field and hook flags independently', () => {
    const diff: NamedValuesShadowDiffResult = {
      mismatchWidgetCount: 1,
      checkedWidgetCount: 1
    }
    const node = fakeNode('CheckpointLoader', {
      onConfigure: () => {}
    })
    reportNamedValuesShadowDiff(node, diff, false)

    expect(trackNamedValuesShadowDiffMismatch).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        had_named_field: false,
        has_on_serialize_hook: false,
        has_on_configure_hook: true
      })
    )
  })
})

describe('named values shadow diff load aggregation', () => {
  beforeEach(() => {
    getCnrIdFromNode.mockReset().mockReturnValue(undefined)
  })

  it('emits a sampled summary aggregating every node checked in the load', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    beginNamedValuesShadowDiffLoad()
    reportNamedValuesShadowDiff(
      fakeNode('KSampler'),
      { mismatchWidgetCount: 1, checkedWidgetCount: 2 },
      true
    )
    reportNamedValuesShadowDiff(
      fakeNode('CheckpointLoader'),
      { mismatchWidgetCount: 0, checkedWidgetCount: 2 },
      true
    )
    endNamedValuesShadowDiffLoad()

    expect(trackNamedValuesShadowDiffSummary).toHaveBeenCalledExactlyOnceWith({
      total_nodes_checked: 2,
      nodes_with_mismatch: 1,
      distinct_node_types: ['KSampler'],
      distinct_pack_ids: []
    })
  })

  it('does not emit a summary when the random sample misses', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999999)

    beginNamedValuesShadowDiffLoad()
    reportNamedValuesShadowDiff(
      fakeNode('KSampler'),
      { mismatchWidgetCount: 1, checkedWidgetCount: 2 },
      true
    )
    endNamedValuesShadowDiffLoad()

    expect(trackNamedValuesShadowDiffSummary).not.toHaveBeenCalled()
  })

  it('does not emit a summary when nothing was checked', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    beginNamedValuesShadowDiffLoad()
    endNamedValuesShadowDiffLoad()

    expect(trackNamedValuesShadowDiffSummary).not.toHaveBeenCalled()
  })

  it('only fires once for nested subgraph loads within one top-level load', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    beginNamedValuesShadowDiffLoad()
    beginNamedValuesShadowDiffLoad()
    reportNamedValuesShadowDiff(
      fakeNode('SubgraphInnerNode'),
      { mismatchWidgetCount: 0, checkedWidgetCount: 1 },
      true
    )
    endNamedValuesShadowDiffLoad()
    expect(trackNamedValuesShadowDiffSummary).not.toHaveBeenCalled()

    reportNamedValuesShadowDiff(
      fakeNode('RootNode'),
      { mismatchWidgetCount: 0, checkedWidgetCount: 1 },
      true
    )
    endNamedValuesShadowDiffLoad()

    expect(trackNamedValuesShadowDiffSummary).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ total_nodes_checked: 2 })
    )
  })
})
