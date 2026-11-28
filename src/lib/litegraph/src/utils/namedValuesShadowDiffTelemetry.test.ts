import { describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { getCnrIdFromNode } from '@/platform/workflowErrors/nodeReplacement/cnrIdUtil'
import { useTelemetry } from '@comfyorg/telemetry'
import type { NamedValuesShadowDiffResult } from './namedValuesShadowDiff'
import {
  beginNamedValuesShadowDiffLoad,
  endNamedValuesShadowDiffLoad,
  reportNamedValuesShadowDiff
} from './namedValuesShadowDiffTelemetry'

vi.mock(import('@comfyorg/telemetry'))

vi.mock(import('@/platform/workflowErrors/nodeReplacement/cnrIdUtil'), () => ({
  getCnrIdFromNode: vi.fn()
}))

function fakeNode(className: string): LGraphNode {
  class FakeNode {}
  Object.defineProperty(FakeNode, 'name', { value: className })
  return new FakeNode() as unknown as LGraphNode
}

describe('reportNamedValuesShadowDiff', () => {
  it('does nothing when there is no diff to report', () => {
    reportNamedValuesShadowDiff(fakeNode('KSampler'), null)
    expect(
      useTelemetry()?.trackNamedValuesShadowDiffMismatch
    ).not.toHaveBeenCalled()
    expect(
      useTelemetry()?.trackNamedValuesShadowDiffSummary
    ).not.toHaveBeenCalled()
  })

  it('does not emit a per-node event for a mismatch', () => {
    vi.mocked(getCnrIdFromNode).mockReturnValue('comfy-core')
    const diff: NamedValuesShadowDiffResult = {
      mismatchWidgetCount: 2,
      checkedWidgetCount: 3
    }
    reportNamedValuesShadowDiff(fakeNode('KSampler'), diff)

    expect(
      useTelemetry()?.trackNamedValuesShadowDiffMismatch
    ).not.toHaveBeenCalled()
  })
})

describe('named values shadow diff load aggregation', () => {
  it('emits a sampled summary aggregating every node checked in the load', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    beginNamedValuesShadowDiffLoad()
    reportNamedValuesShadowDiff(fakeNode('KSampler'), {
      mismatchWidgetCount: 1,
      checkedWidgetCount: 2
    })
    reportNamedValuesShadowDiff(fakeNode('CheckpointLoader'), {
      mismatchWidgetCount: 0,
      checkedWidgetCount: 2
    })
    endNamedValuesShadowDiffLoad()

    expect(
      useTelemetry()?.trackNamedValuesShadowDiffSummary
    ).toHaveBeenCalledExactlyOnceWith({
      total_nodes_checked: 2,
      nodes_with_mismatch: 1,
      distinct_node_types: ['KSampler'],
      distinct_pack_ids: []
    })
    expect(
      useTelemetry()?.trackNamedValuesShadowDiffMismatch
    ).not.toHaveBeenCalled()
  })

  it('does not emit a summary when the random sample misses', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999999)

    beginNamedValuesShadowDiffLoad()
    reportNamedValuesShadowDiff(fakeNode('KSampler'), {
      mismatchWidgetCount: 1,
      checkedWidgetCount: 2
    })
    endNamedValuesShadowDiffLoad()

    expect(
      useTelemetry()?.trackNamedValuesShadowDiffSummary
    ).not.toHaveBeenCalled()
  })

  it('does not emit a summary when nothing was checked', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    beginNamedValuesShadowDiffLoad()
    endNamedValuesShadowDiffLoad()

    expect(
      useTelemetry()?.trackNamedValuesShadowDiffSummary
    ).not.toHaveBeenCalled()
  })

  it('only fires once for nested subgraph loads within one top-level load', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    beginNamedValuesShadowDiffLoad()
    beginNamedValuesShadowDiffLoad()
    reportNamedValuesShadowDiff(fakeNode('SubgraphInnerNode'), {
      mismatchWidgetCount: 0,
      checkedWidgetCount: 1
    })
    endNamedValuesShadowDiffLoad()
    expect(
      useTelemetry()?.trackNamedValuesShadowDiffSummary
    ).not.toHaveBeenCalled()

    reportNamedValuesShadowDiff(fakeNode('RootNode'), {
      mismatchWidgetCount: 0,
      checkedWidgetCount: 1
    })
    endNamedValuesShadowDiffLoad()

    expect(
      useTelemetry()?.trackNamedValuesShadowDiffSummary
    ).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ total_nodes_checked: 2 })
    )
  })
})
