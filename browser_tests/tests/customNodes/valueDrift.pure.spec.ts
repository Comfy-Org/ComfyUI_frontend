import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import {
  matchesTopologyExpectation,
  OUTPUT_TOPOLOGY_EXPECTATIONS_LITEGRAPH,
  OUTPUT_TOPOLOGY_EXPECTATIONS_VUE,
  pendingRoundtripInitializations,
  rendererLedgerFor,
  ROUNDTRIP_NODE_LOSS_EXPECTATIONS_LITEGRAPH,
  ROUNDTRIP_NODE_LOSS_EXPECTATIONS_VUE,
  ROUNDTRIP_VALUE_ALLOWED_INDICES_LITEGRAPH,
  ROUNDTRIP_VALUE_ALLOWED_INDICES_VUE,
  ROUNDTRIP_VALUE_ALLOWED_KEYS_LITEGRAPH,
  ROUNDTRIP_VALUE_ALLOWED_KEYS_VUE,
  staleValueDriftIndices,
  staleValueDriftKeys
} from '@e2e/fixtures/customNode/valueDrift'

test.describe('rendererLedgerFor', () => {
  test('selects only the active renderer ledger', () => {
    const litegraph: Record<string, string> = { LitegraphNode: '3' }
    const vue: Record<string, string> = { VueNode: '5' }

    expect(rendererLedgerFor(false, litegraph, vue)).toBe(litegraph)
    expect(rendererLedgerFor(true, litegraph, vue)).toBe(vue)
  })
})

test.describe('output topology', () => {
  test('accepts only the exact expected output transition', () => {
    const expectation = {
      before: 20,
      after: 4,
      reason: 'pack JS exposes only the default 4 of 20 declared outputs'
    }

    expect(matchesTopologyExpectation(expectation, 20, 4)).toBe(true)
    expect(matchesTopologyExpectation(expectation, 20, 3)).toBe(false)
    expect(matchesTopologyExpectation(expectation, 19, 4)).toBe(false)
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

test('roundtrip initialization waits for the exact pack-owned ready value', () => {
  const signals = {
    LoadAudioUI: {
      property: '_initializing',
      predicate: 'equals' as const,
      value: false
    },
    SAM3VideoSegmentation: {
      property: '_hiddenInputs',
      predicate: 'defined' as const
    },
    iToolsPaintNode: {
      predicate: 'widget-count' as const,
      value: 33
    }
  }
  expect(
    pendingRoundtripInitializations(signals, {
      LoadAudioUI: true,
      SAM3VideoSegmentation: undefined,
      iToolsPaintNode: 32
    })
  ).toEqual(['LoadAudioUI', 'SAM3VideoSegmentation', 'iToolsPaintNode'])
  expect(
    pendingRoundtripInitializations(signals, {
      LoadAudioUI: false,
      SAM3VideoSegmentation: {},
      iToolsPaintNode: 33
    })
  ).toEqual([])
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

test.describe('staleValueDriftKeys', () => {
  test('requires every allowed node/key pair to be observed', () => {
    expect(
      staleValueDriftKeys(
        { ExampleNode: ['button', 'preview'] },
        { ExampleNode: ['button'] }
      )
    ).toEqual(['ExampleNode.preview'])
  })

  test('ignores unrelated observations', () => {
    expect(
      staleValueDriftKeys(
        { ExampleNode: ['button'] },
        { ExampleNode: ['button'], OtherNode: ['preview'] }
      )
    ).toEqual([])
  })
})

test.describe('cloud roundtrip expectations', () => {
  test('pins only the observed widget indices', () => {
    expect(ROUNDTRIP_VALUE_ALLOWED_INDICES_LITEGRAPH).toMatchObject({
      'ComfyUI_Fill-Nodes': {
        FL_ColorPicker: '3,4,5,6',
        FL_ReplaceColor: '5,6,7,8,9,10,11,12'
      },
      'ComfyUI-KJNodes': { SplineEditor: '1' },
      'ComfyUI-LTXVideo': { LTXVSparseTrackEditor: '1' },
      'WhatDreamsCost-ComfyUI': {
        LoadAudioUI: '5',
        LTXDirector: '3,4,5,7'
      },
      'comfyui-itools': { iToolsRegexNode: '0' }
    })
    expect(ROUNDTRIP_VALUE_ALLOWED_INDICES_VUE).toMatchObject({
      'ComfyUI_Fill-Nodes':
        ROUNDTRIP_VALUE_ALLOWED_INDICES_LITEGRAPH['ComfyUI_Fill-Nodes'],
      'ComfyUI-KJNodes': { SplineEditor: '1' },
      'ComfyUI-LTXVideo': { LTXVSparseTrackEditor: '1' },
      'WhatDreamsCost-ComfyUI': {
        LoadAudioUI: '5',
        LTXDirector: '3,4,5,7'
      },
      'comfyui-itools': { iToolsRegexNode: '0' }
    })
    expect(ROUNDTRIP_VALUE_ALLOWED_KEYS_LITEGRAPH).toEqual({
      'ComfyUI-VideoHelperSuite': {
        VHS_LoadAudioUpload: 'choose audio to upload',
        VHS_LoadImages: 'choose folder to upload',
        VHS_LoadVideo: 'choose video to upload',
        VHS_LoadVideoFFmpeg: 'choose video to upload',
        VHS_VAEDecodeBatched: 'per_batch',
        VHS_VAEEncodeBatched: 'per_batch'
      }
    })
    expect(ROUNDTRIP_VALUE_ALLOWED_KEYS_VUE).toEqual(
      ROUNDTRIP_VALUE_ALLOWED_KEYS_LITEGRAPH
    )
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
