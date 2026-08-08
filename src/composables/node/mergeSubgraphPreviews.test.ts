import { describe, expect, it } from 'vitest'

import { toNodeId } from '@/types/nodeId'

import { mergeSubgraphPreviews } from './mergeSubgraphPreviews'
import type { PromotedPreview } from './usePromotedPreviews'

function preview(
  sourceNodeId: number | string,
  overrides: Partial<PromotedPreview> = {}
): PromotedPreview {
  return {
    sourceNodeId: toNodeId(sourceNodeId),
    sourceWidgetName: 'preview',
    type: 'image',
    urls: ['/view?filename=test.png'],
    ...overrides
  }
}

describe(mergeSubgraphPreviews, () => {
  it('returns both when there is no overlap', () => {
    const promoted = [preview(1)]
    const ambient = [preview(2)]

    const result = mergeSubgraphPreviews(promoted, ambient, [toNodeId(1)])

    expect(result).toEqual([preview(1), preview(2)])
  })

  it('drops the ambient entry for a node the host has exposed, keeping the exposure', () => {
    const promoted = [preview(3, { sourceWidgetName: 'exposed-name' })]
    const ambient = [preview(3, { sourceWidgetName: '$$ambient-preview' })]

    const result = mergeSubgraphPreviews(promoted, ambient, [toNodeId(3)])

    expect(result).toEqual([preview(3, { sourceWidgetName: 'exposed-name' })])
  })

  it('does not drop an ambient node whose id only collides with a nested exposure leaf id', () => {
    // `promoted` resolved through a nested subgraph to leaf id 3 in that
    // nested graph's id space. The host's own exposures (what actually
    // shares this host's id space) don't include node 3, so the host's own
    // interior node 3 must still surface ambiently instead of being
    // suppressed by the unrelated leaf id.
    const promoted = [preview(3, { sourceWidgetName: 'nested-exposure' })]
    const ambient = [preview(3, { sourceWidgetName: '$$ambient-preview' })]
    const hostsOwnExposedIds = [toNodeId(7)]

    const result = mergeSubgraphPreviews(promoted, ambient, hostsOwnExposedIds)

    expect(result).toEqual([
      preview(3, { sourceWidgetName: 'nested-exposure' }),
      preview(3, { sourceWidgetName: '$$ambient-preview' })
    ])
  })

  it('returns promoted unchanged when there are no ambient previews', () => {
    const promoted = [preview(1)]

    const result = mergeSubgraphPreviews(promoted, [], [])

    expect(result).toEqual(promoted)
  })
})
