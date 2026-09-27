import { describe, expect, it } from 'vitest'
import {
  declaredInputNamesForTypes,
  initializationSignalsForTypes,
  isCanvasPreviewImagePath,
  matchesTopologyExpectation,
  namedWidgetValueDrifts,
  pendingRestoredPreviewWidgets,
  pendingRoundtripInitializations,
  rendererLedgerFor,
  staleValueDriftIndices,
  staleValueDriftKeys
} from '@e2e/fixtures/customNode/valueDrift'

describe('declaredInputNamesForTypes', () => {
  it('includes backend inputs and excludes frontend-only widgets', () => {
    const defs = {
      DynamicNode: {
        input: {
          required: { num_images: ['INT', {}] },
          optional: { strength_1: ['FLOAT', {}] }
        }
      }
    }

    expect(declaredInputNamesForTypes(defs, ['DynamicNode'])).toEqual({
      DynamicNode: ['num_images', 'strength_1']
    })
    expect(() => declaredInputNamesForTypes(defs, ['MissingNode'])).toThrow(
      'MissingNode has no backend node definition'
    )
  })
})

describe('rendererLedgerFor', () => {
  it('selects only the active renderer ledger', () => {
    const litegraph: Record<string, string> = { LitegraphNode: '3' }
    const vue: Record<string, string> = { VueNode: '5' }

    expect(rendererLedgerFor(false, litegraph, vue)).toBe(litegraph)
    expect(rendererLedgerFor(true, litegraph, vue)).toBe(vue)
  })
})

describe('output topology', () => {
  it('accepts only the exact expected output transition', () => {
    const expectation = {
      before: 20,
      after: 4,
      reason: 'pack JS exposes only the default 4 of 20 declared outputs'
    }

    expect(matchesTopologyExpectation(expectation, 20, 4)).toBe(true)
    expect(matchesTopologyExpectation(expectation, 20, 3)).toBe(false)
    expect(matchesTopologyExpectation(expectation, 19, 4)).toBe(false)
  })

  it('rejects an unledgered transition as a roundtrip exception', () => {
    expect(matchesTopologyExpectation(undefined, 154, 8)).toBe(false)
  })
})

it('roundtrip initialization waits for pack-owned ready values', () => {
  const signals = {
    LoadAudioUI: {
      property: '_initializing',
      predicate: 'equals' as const,
      value: false
    },
    SAM3VideoSegmentation: {
      inputs: ['positive_boxes', 'negative_boxes'],
      predicate: 'inputs-absent' as const
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
        SAM3VideoSegmentation: ['positive_boxes', 'video_frames'],
        iToolsPaintNode: 32,
        ImageTransformKJ: ''
      },
      false
    )
  ).toEqual([
    'LoadAudioUI (litegraph: expected false, observed true)',
    'SAM3VideoSegmentation (litegraph: expected inputs absent [positive_boxes,negative_boxes], observed ["positive_boxes","video_frames"])',
    'iToolsPaintNode (litegraph: expected 33 widgets, observed 32)',
    'ImageTransformKJ (litegraph: expected bboxes = "{\\"fillColor\\":\\"#000000\\"}", observed "")'
  ])
  expect(
    pendingRoundtripInitializations(
      signals,
      {
        LoadAudioUI: false,
        SAM3VideoSegmentation: ['positive_points', 'video_frames'],
        iToolsPaintNode: 33,
        ImageTransformKJ: '{"fillColor":"#000000"}'
      },
      false
    )
  ).toEqual([])

  const unavailableValues: Record<string, unknown> | undefined = undefined
  expect(
    pendingRoundtripInitializations(signals, unavailableValues, false)
  ).toEqual([
    'LoadAudioUI (litegraph: expected false, observed undefined)',
    'SAM3VideoSegmentation (litegraph: expected inputs absent [positive_boxes,negative_boxes], observed undefined)',
    'iToolsPaintNode (litegraph: expected 33 widgets, observed undefined)',
    'ImageTransformKJ (litegraph: expected bboxes = "{\\"fillColor\\":\\"#000000\\"}", observed undefined)'
  ])
})

it('roundtrip initialization signals apply only to their node batch', () => {
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

it('roundtrip waits for required canvas previews after reload', () => {
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

it('requires canvas previews only for supported image upload paths', () => {
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

describe('staleValueDriftIndices', () => {
  it('requires every allowed node/index pair to be observed', () => {
    expect(
      staleValueDriftIndices({ ExampleNode: [3, 4] }, { ExampleNode: [3] })
    ).toEqual(['ExampleNode[4]'])
  })

  it('returns every missing index and ignores unrelated observations', () => {
    expect(
      staleValueDriftIndices(
        { ExampleNode: [1, 5], MissingNode: [0] },
        { ExampleNode: [1, 5], OtherNode: [0] }
      )
    ).toEqual(['MissingNode[0]'])
  })
})

describe('staleValueDriftKeys', () => {
  it('requires every allowed node/key pair to be observed', () => {
    expect(
      staleValueDriftKeys(
        { ExampleNode: ['button', 'preview'] },
        { ExampleNode: ['button'] }
      )
    ).toEqual(['ExampleNode.preview'])
  })

  it('ignores unrelated observations', () => {
    expect(
      staleValueDriftKeys(
        { ExampleNode: ['button'] },
        { ExampleNode: ['button'], OtherNode: ['preview'] }
      )
    ).toEqual([])
  })
})

describe('namedWidgetValueDrifts', () => {
  it('compares surviving widgets by name when dependent widgets change', () => {
    expect(
      namedWidgetValueDrifts(
        {
          prompt_mode: 'point',
          text_prompt: '_cn',
          frame_idx: 1,
          score_threshold: 0.35
        },
        {
          prompt_mode: 'point',
          frame_idx: 1,
          score_threshold: 0.35
        }
      )
    ).toEqual([])

    expect(
      namedWidgetValueDrifts(
        { mode: 'basic', strength: 1 },
        { mode: 'advanced', strength: 1, detail: 0.5 }
      )
    ).toEqual([{ name: 'mode', before: 'basic', after: 'advanced' }])

    expect(
      namedWidgetValueDrifts(
        { mode: 'basic', derived: 'preview' },
        { derived: 'updated' },
        ['mode']
      )
    ).toEqual([{ name: 'mode', before: 'basic', after: undefined }])
    expect(
      namedWidgetValueDrifts({ derived: 'preview' }, { derived: 'updated' }, [
        'mode'
      ])
    ).toEqual([])
  })

  it('fails closed when named values cannot be compared', () => {
    expect(namedWidgetValueDrifts(undefined, { mode: 'basic' })).toBeNull()
    expect(namedWidgetValueDrifts(['basic'], { mode: 'basic' })).toBeNull()
    expect(
      namedWidgetValueDrifts({ mode: 'basic' }, { detail: 0.5 })
    ).toBeNull()
  })
})
