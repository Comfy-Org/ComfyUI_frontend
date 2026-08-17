import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import {
  matchesTopologyExpectation,
  OUTPUT_TOPOLOGY_EXPECTATIONS_LITEGRAPH,
  OUTPUT_TOPOLOGY_EXPECTATIONS_VUE,
  partitionValueDriftNodes,
  pendingWidgetInitializations,
  rendererLedgerFor,
  ROUNDTRIP_NODE_LOSS_EXPECTATIONS_LITEGRAPH,
  ROUNDTRIP_NODE_LOSS_EXPECTATIONS_VUE,
  ROUNDTRIP_VALUE_ALLOWED_INDICES_LITEGRAPH,
  ROUNDTRIP_VALUE_ALLOWED_INDICES_VUE,
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
})

test.describe('widget topology', () => {
  test('waits for each pack-owned initialization signal', () => {
    const signals = {
      ExampleKeyframer: '_currentImageCount',
      ExampleSequencer: '_currentImageCount'
    }

    expect(
      pendingWidgetInitializations(signals, {
        ExampleKeyframer: -1,
        ExampleSequencer: undefined
      })
    ).toEqual(['ExampleKeyframer', 'ExampleSequencer'])
    expect(
      pendingWidgetInitializations(signals, {
        ExampleKeyframer: 0,
        ExampleSequencer: 1
      })
    ).toEqual([])
  })

  test('accepts only the exact expected output transition', () => {
    const expectation = {
      before: 20,
      after: 4,
      reason: 'pack JS exposes only the default 4 of 20 declared outputs'
    }

    expect(matchesTopologyExpectation(expectation, 20, 4)).toBe(true)
    expect(matchesTopologyExpectation(expectation, 20, 3)).toBe(false)
    expect(matchesTopologyExpectation(expectation, 19, 4)).toBe(false)
    const rangeExpectation = {
      before: 20,
      after: [3, 4] as const,
      reason: 'pack JS restores either default'
    }
    expect(matchesTopologyExpectation(rangeExpectation, 20, 3)).toBe(true)
    expect(matchesTopologyExpectation(rangeExpectation, 20, 5)).toBe(false)
  })

  test('rejects an unledgered transition as a roundtrip exception', () => {
    expect(matchesTopologyExpectation(undefined, 154, 8)).toBe(false)
  })

  test('pins pack-owned output trimming under both renderers', () => {
    for (const ledger of [
      OUTPUT_TOPOLOGY_EXPECTATIONS_LITEGRAPH,
      OUTPUT_TOPOLOGY_EXPECTATIONS_VUE
    ]) {
      expect(ledger['ComfyUI_Fill-Nodes'].FL_VideoBatchSplitter).toMatchObject({
        before: 20,
        after: 4
      })
      expect(ledger['WhatDreamsCost-ComfyUI'].MultiImageLoader).toMatchObject({
        before: 51,
        after: 1
      })
    }
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

test.describe('cloud roundtrip expectations', () => {
  test('pins only the observed widget indices', () => {
    expect(ROUNDTRIP_VALUE_ALLOWED_INDICES_LITEGRAPH).toMatchObject({
      'ComfyUI_Fill-Nodes': {
        FL_ColorPicker: '3,4,5,6',
        FL_ReplaceColor: '5,6,7,8,9,10,11,12'
      },
      'WhatDreamsCost-ComfyUI': {
        LoadAudioUI: '5',
        LTXDirector: '3,4,5,7'
      }
    })
    expect(ROUNDTRIP_VALUE_ALLOWED_INDICES_VUE).toMatchObject({
      'ComfyUI_Fill-Nodes':
        ROUNDTRIP_VALUE_ALLOWED_INDICES_LITEGRAPH['ComfyUI_Fill-Nodes'],
      'WhatDreamsCost-ComfyUI': {
        LoadAudioUI: '2,3,5',
        LTXDirector: '3,4,5,7'
      },
      'comfyui-itools': { iToolsRegexNode: '0' }
    })
  })

  test('keeps the FL_TimeLine loss temporary and renderer-explicit', () => {
    expect(
      ROUNDTRIP_NODE_LOSS_EXPECTATIONS_LITEGRAPH['ComfyUI_Fill-Nodes']
        .FL_TimeLine
    ).toMatchObject({
      reason: expect.stringContaining('node.serialize'),
      restore: expect.stringContaining('remove this entry')
    })
    expect(ROUNDTRIP_NODE_LOSS_EXPECTATIONS_VUE).toEqual(
      ROUNDTRIP_NODE_LOSS_EXPECTATIONS_LITEGRAPH
    )
  })
})
