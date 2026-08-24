import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import {
  initializationSignalsForTypes,
  isCanvasPreviewImagePath,
  matchesTopologyExpectation,
  OUTPUT_TOPOLOGY_EXPECTATIONS_LITEGRAPH,
  OUTPUT_TOPOLOGY_EXPECTATIONS_VUE,
  pendingRestoredPreviewWidgets,
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

test('roundtrip initialization waits for pack-owned ready values', () => {
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
    },
    ImageTransformKJ: {
      predicate: 'widget-value' as const,
      value: '{"fillColor":"#000000"}',
      widget: 'bboxes'
    }
  }
  expect(
    pendingRoundtripInitializations(
      signals,
      {
        LoadAudioUI: true,
        SAM3VideoSegmentation: undefined,
        iToolsPaintNode: 32,
        ImageTransformKJ: ''
      },
      false
    )
  ).toEqual([
    'LoadAudioUI (litegraph: expected false, observed true)',
    'SAM3VideoSegmentation (litegraph: expected defined, observed undefined)',
    'iToolsPaintNode (litegraph: expected 33 widgets, observed 32)',
    'ImageTransformKJ (litegraph: expected bboxes = "{\\"fillColor\\":\\"#000000\\"}", observed "")'
  ])
  expect(
    pendingRoundtripInitializations(
      signals,
      {
        LoadAudioUI: false,
        SAM3VideoSegmentation: {},
        iToolsPaintNode: 33,
        ImageTransformKJ: '{"fillColor":"#000000"}'
      },
      false
    )
  ).toEqual([])
})

test('roundtrip initialization signals apply only to their node batch', () => {
  const signals = {
    ImageTransformKJ: {
      predicate: 'widget-value' as const,
      value: '{"fillColor":"#000000"}',
      widget: 'bboxes'
    },
    SplineEditor: {
      property: '_initialized',
      predicate: 'defined' as const
    }
  }

  expect(
    initializationSignalsForTypes(signals, [
      'ImageTransformKJ',
      'UnrelatedNode'
    ])
  ).toEqual({ ImageTransformKJ: signals.ImageTransformKJ })
  expect(initializationSignalsForTypes(signals, ['UnrelatedNode'])).toEqual({})
})

test('roundtrip waits for required canvas previews after reload', () => {
  const required = {
    iToolsLoadImagePlus: ['$$canvas-image-preview'],
    LoadImageWithExif: ['$$canvas-image-preview']
  }

  expect(
    pendingRestoredPreviewWidgets(required, {
      iToolsLoadImagePlus: ['image', 'upload'],
      LoadImageWithExif: [
        'image',
        'default_focal_mm',
        'upload',
        '$$canvas-image-preview'
      ]
    })
  ).toEqual([
    'iToolsLoadImagePlus: expected $$canvas-image-preview after reload, observed [image,upload]'
  ])
  expect(
    pendingRestoredPreviewWidgets(required, {
      iToolsLoadImagePlus: ['image', 'upload', '$$canvas-image-preview'],
      LoadImageWithExif: ['image', 'upload', '$$canvas-image-preview']
    })
  ).toEqual([])
})

test('requires canvas previews only for supported image upload paths', () => {
  for (const value of [
    'input/example.png',
    'example.JPG',
    'example.jpeg [output]',
    'nested/example.webp[temp]'
  ]) {
    expect(isCanvasPreviewImagePath(value)).toBe(true)
  }

  for (const value of [
    '(upload a mesh file)',
    'example.glb',
    '',
    null,
    undefined
  ]) {
    expect(isCanvasPreviewImagePath(value)).toBe(false)
  }
  expect(isCanvasPreviewImagePath('input/example.png')).toBe(true)
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
        LoadAudioUI: '2,3,5',
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
        LoadAudioUI: '2,3,5',
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
