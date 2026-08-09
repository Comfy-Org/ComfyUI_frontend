import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import {
  matchesTopologyExpectation,
  OUTPUT_TOPOLOGY_EXPECTATIONS_LITEGRAPH,
  OUTPUT_TOPOLOGY_EXPECTATIONS_VUE,
  partitionValueDriftNodes,
  rendererLedgerFor,
  ROUNDTRIP_VALUE_ALLOWED_INDICES_LITEGRAPH,
  ROUNDTRIP_VALUE_ALLOWED_INDICES_VUE,
  ROUNDTRIP_WIDGET_TOPOLOGY_EXPECTATIONS_LITEGRAPH,
  ROUNDTRIP_WIDGET_TOPOLOGY_EXPECTATIONS_VUE,
  staleValueDriftIndices
} from '@e2e/fixtures/customNode/valueDrift'

test.describe('rendererLedgerFor', () => {
  test('selects only the active renderer ledger', () => {
    const litegraph: Record<string, string> = { LitegraphNode: '3' }
    const vue: Record<string, string> = { VueNode: '5' }

    expect(rendererLedgerFor(false, litegraph, vue)).toBe(litegraph)
    expect(rendererLedgerFor(true, litegraph, vue)).toBe(vue)
  })

  test('never downgrades an opposite-renderer exact node to a broad exception', () => {
    expect(
      partitionValueDriftNodes(
        { LegacyNode: 'reason', LitegraphNode: 'reason', VueNode: 'reason' },
        [{ LitegraphNode: '3' }, { VueNode: '5' }]
      )
    ).toEqual({
      exact: ['LitegraphNode', 'VueNode'],
      legacy: ['LegacyNode']
    })
  })

  test('routes each artifact-proven mechanism to every observed renderer', () => {
    const nodes = <T>(ledger: Record<string, Record<string, T>>) =>
      Object.values(ledger)
        .flatMap((entries) => Object.keys(entries))
        .sort()

    expect(nodes(ROUNDTRIP_VALUE_ALLOWED_INDICES_LITEGRAPH)).toEqual([
      'FL_ColorPicker',
      'FL_ReplaceColor',
      'LTXDirector',
      'LTXVSparseTrackEditor',
      'LoadAudioUI'
    ])
    expect(nodes(ROUNDTRIP_VALUE_ALLOWED_INDICES_VUE)).toEqual([
      'FL_ColorPicker',
      'FL_ReplaceColor',
      'LTXDirector',
      'LTXVSparseTrackEditor',
      'LoadAudioUI',
      'RadianceSamplerPro',
      'iToolsRegexNode'
    ])
    expect(
      ROUNDTRIP_VALUE_ALLOWED_INDICES_LITEGRAPH['WhatDreamsCost-ComfyUI']
        .LoadAudioUI
    ).toBe('5')
    expect(nodes(ROUNDTRIP_WIDGET_TOPOLOGY_EXPECTATIONS_LITEGRAPH)).toEqual([
      'LTXKeyframer'
    ])
    expect(nodes(ROUNDTRIP_WIDGET_TOPOLOGY_EXPECTATIONS_VUE)).toEqual([
      'LTXKeyframer',
      'LTXSequencer'
    ])
    expect(nodes(OUTPUT_TOPOLOGY_EXPECTATIONS_LITEGRAPH)).toEqual([
      'FL_VideoBatchSplitter'
    ])
    expect(nodes(OUTPUT_TOPOLOGY_EXPECTATIONS_VUE)).toEqual([
      'FL_VideoBatchSplitter'
    ])
  })
})

test.describe('matchesTopologyExpectation', () => {
  test('accepts only the exact artifact-proven output transition', () => {
    const expectation =
      OUTPUT_TOPOLOGY_EXPECTATIONS_LITEGRAPH['ComfyUI_Fill-Nodes']
        .FL_VideoBatchSplitter

    expect(matchesTopologyExpectation(expectation, 20, 4)).toBe(true)
    expect(matchesTopologyExpectation(expectation, 20, 3)).toBe(false)
    expect(matchesTopologyExpectation(expectation, 19, 4)).toBe(false)
    const vueExpectation =
      OUTPUT_TOPOLOGY_EXPECTATIONS_VUE['ComfyUI_Fill-Nodes']
        .FL_VideoBatchSplitter
    expect(matchesTopologyExpectation(vueExpectation, 20, 4)).toBe(true)
    expect(matchesTopologyExpectation(vueExpectation, 20, 3)).toBe(false)
  })

  test('accepts only the exact artifact-proven widget transition', () => {
    const expectation =
      ROUNDTRIP_WIDGET_TOPOLOGY_EXPECTATIONS_LITEGRAPH['WhatDreamsCost-ComfyUI']
        .LTXKeyframer

    expect(matchesTopologyExpectation(expectation, 102, 2)).toBe(true)
    expect(matchesTopologyExpectation(expectation, 102, 5)).toBe(true)
    expect(matchesTopologyExpectation(expectation, 102, 0)).toBe(false)
    expect(matchesTopologyExpectation(expectation, 102, 3)).toBe(false)
    expect(matchesTopologyExpectation(expectation, 102, 4)).toBe(false)
    expect(matchesTopologyExpectation(expectation, 101, 5)).toBe(false)
    const vueExpectations =
      ROUNDTRIP_WIDGET_TOPOLOGY_EXPECTATIONS_VUE['WhatDreamsCost-ComfyUI']
    for (const exactExpectation of [expectation, vueExpectations.LTXKeyframer])
      expect(exactExpectation).toMatchObject({ before: 102, after: [2, 5] })
    expect(
      matchesTopologyExpectation(vueExpectations.LTXKeyframer, 102, 5)
    ).toBe(true)
    expect(
      matchesTopologyExpectation(vueExpectations.LTXKeyframer, 102, 2)
    ).toBe(true)
    expect(
      matchesTopologyExpectation(vueExpectations.LTXKeyframer, 102, 0)
    ).toBe(false)
    expect(
      matchesTopologyExpectation(vueExpectations.LTXKeyframer, 102, 3)
    ).toBe(false)
    expect(
      matchesTopologyExpectation(vueExpectations.LTXKeyframer, 102, 4)
    ).toBe(false)
    expect(
      matchesTopologyExpectation(vueExpectations.LTXSequencer, 154, 8)
    ).toBe(true)
    expect(
      matchesTopologyExpectation(vueExpectations.LTXSequencer, 154, 7)
    ).toBe(false)
    expect(
      matchesTopologyExpectation(
        ROUNDTRIP_WIDGET_TOPOLOGY_EXPECTATIONS_LITEGRAPH[
          'WhatDreamsCost-ComfyUI'
        ].LTXSequencer,
        154,
        8
      )
    ).toBe(false)
  })
})

test.describe('staleValueDriftIndices', () => {
  test('requires every allowed node/index pair to be observed', () => {
    expect(
      staleValueDriftIndices({ ExampleNode: [3, 4] }, { ExampleNode: [3] })
    ).toEqual(['ExampleNode[4]'])
  })

  test('returns every missing index and ignores unrelated observations', () => {
    expect(
      staleValueDriftIndices(
        { ExampleNode: [1, 5], MissingNode: [0] },
        { ExampleNode: [1, 5], OtherNode: [0] }
      )
    ).toEqual(['MissingNode[0]'])
  })
})
