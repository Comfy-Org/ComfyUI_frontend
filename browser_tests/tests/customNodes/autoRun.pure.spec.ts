import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import {
  AUTO_RUN_ALLOWED_FAILURES,
  batchAutoRunnable,
  classifyAutoRunnable,
  matchesAllowedAutoRunOutcome,
  planAutoRuns
} from '@e2e/fixtures/customNode/autoRun'

const SYNTH = new Set([
  'IMAGE',
  'LATENT',
  'MASK',
  'INT',
  'FLOAT',
  'STRING',
  'BOOLEAN',
  '*'
])

test.describe('autoRun classifier', () => {
  test('widget-only node with outputs is runnable via a PreviewAny sink', () => {
    const verdict = classifyAutoRunnable(
      'IntConstant',
      {
        input: { required: { value: ['INT', { default: 0 }] } },
        output: ['INT'],
        output_node: false
      },
      SYNTH
    )
    expect(verdict.verdict).toBe('AUTO_RUNNABLE')
    expect(verdict.needsPreviewSink).toBe(true)
  })

  test('widget-only OUTPUT_NODE runs standalone', () => {
    const verdict = classifyAutoRunnable(
      'ShowValue',
      {
        input: {
          required: {
            text: ['STRING', {}],
            mode: [['raw value', 'tensor shape']]
          }
        },
        output: [],
        output_node: true
      },
      SYNTH
    )
    expect(verdict.verdict).toBe('AUTO_RUNNABLE')
    expect(verdict.needsPreviewSink).toBe(false)
  })

  test('synthesizable sockets make a node CHAINABLE with its socket list', () => {
    const verdict = classifyAutoRunnable(
      'MaskComposite',
      {
        input: {
          required: {
            destination: ['MASK'],
            source: ['MASK'],
            x: ['INT', { default: 0 }],
            operation: [['multiply', 'add']]
          }
        },
        output: ['MASK'],
        output_node: false
      },
      SYNTH
    )
    expect(verdict.verdict).toBe('CHAINABLE')
    expect(verdict.requiredSockets).toEqual([
      { name: 'destination', type: 'MASK' },
      { name: 'source', type: 'MASK' }
    ])
    expect(verdict.needsPreviewSink).toBe(true)
  })

  test('a union socket resolves to its first synthesizable member', () => {
    const verdict = classifyAutoRunnable(
      'UnionConsumer',
      {
        input: { required: { pixels: ['VAE,IMAGE'] } },
        output: ['IMAGE'],
        output_node: false
      },
      SYNTH
    )
    expect(verdict.verdict).toBe('CHAINABLE')
    // The MEMBER is pushed, not the union string - the chain builder
    // synthesizes a producer for exactly this type.
    expect(verdict.requiredSockets).toEqual([{ name: 'pixels', type: 'IMAGE' }])
  })

  test('a union socket with no synthesizable member means NEEDS_WIRES', () => {
    const verdict = classifyAutoRunnable(
      'UnionNeedsWires',
      {
        input: { required: { model: ['MODEL,VAE'] } },
        output: ['IMAGE'],
        output_node: false
      },
      SYNTH
    )
    expect(verdict.verdict).toBe('NEEDS_WIRES')
    expect(verdict.reason).toContain('MODEL,VAE')
  })

  test('a socket with no model-free producer means NEEDS_WIRES', () => {
    const verdict = classifyAutoRunnable(
      'VaeDecode',
      {
        input: { required: { samples: ['LATENT'], vae: ['VAE'] } },
        output: ['IMAGE'],
        output_node: false
      },
      SYNTH
    )
    expect(verdict.verdict).toBe('NEEDS_WIRES')
    expect(verdict.reason).toContain('vae')
  })

  test('forceInput STRING is a socket but STRING is synthesizable', () => {
    const verdict = classifyAutoRunnable(
      'TextSink',
      {
        input: { required: { text: ['STRING', { forceInput: true }] } },
        output: ['STRING'],
        output_node: true
      },
      SYNTH
    )
    expect(verdict.verdict).toBe('CHAINABLE')
    expect(verdict.requiredSockets).toEqual([{ name: 'text', type: 'STRING' }])
  })

  test('a declared widgetType makes an unproducible type a widget', () => {
    const declared = classifyAutoRunnable(
      'PainterLike',
      {
        input: {
          required: { mask: ['FILE_3D', { default: '', widgetType: 'STRING' }] }
        },
        output: ['IMAGE'],
        output_node: false
      },
      SYNTH
    )
    expect(declared.verdict).toBe('AUTO_RUNNABLE')

    const undeclared = classifyAutoRunnable(
      'PainterLike',
      {
        input: { required: { mask: ['FILE_3D', { default: '' }] } },
        output: ['IMAGE'],
        output_node: false
      },
      SYNTH
    )
    expect(undeclared.verdict).toBe('NEEDS_WIRES')
  })

  test('forceInput beats a declared widgetType', () => {
    const verdict = classifyAutoRunnable(
      'ForcedPainterLike',
      {
        input: {
          required: {
            mask: ['FILE_3D', { widgetType: 'STRING', forceInput: true }]
          }
        },
        output: ['IMAGE'],
        output_node: false
      },
      SYNTH
    )
    expect(verdict.verdict).toBe('NEEDS_WIRES')
    expect(verdict.reason).toContain('mask')
  })

  test('an empty required combo means NEEDS_MODELS', () => {
    const verdict = classifyAutoRunnable(
      'CheckpointLoader',
      {
        input: { required: { ckpt_name: [[]] } },
        output: ['MODEL'],
        output_node: false
      },
      SYNTH
    )
    expect(verdict.verdict).toBe('NEEDS_MODELS')
    expect(verdict.reason).toContain('ckpt_name')
  })

  // Census-derived: transformed (V2-schema) defs carry combos as the string
  // 'COMBO' with options in the opts object - the classifier must not read
  // that as an unproducible socket type.
  test('a V2-form combo with options is a widget', () => {
    const verdict = classifyAutoRunnable(
      'LatentConcatLike',
      {
        input: {
          required: {
            dim: ['COMBO', { multiselect: false, options: ['x', '-x', 'y'] }]
          }
        },
        output: ['LATENT'],
        output_node: false
      },
      SYNTH
    )
    expect(verdict.verdict).toBe('AUTO_RUNNABLE')
  })

  // Census-derived (DevToolsNodeWithOutputCombo.subset_options): a combo
  // carrying forceInput is a socket in ANY form - no widget materializes,
  // so its option list cannot satisfy the input.
  test('forceInput on a list-form combo is a socket, not a widget', () => {
    const verdict = classifyAutoRunnable(
      'OutputComboLike',
      {
        input: {
          required: { subset_options: [['A', 'B'], { forceInput: true }] }
        },
        output: ['COMBO'],
        output_node: false
      },
      SYNTH
    )
    expect(verdict.verdict).toBe('NEEDS_WIRES')
    expect(verdict.reason).toContain('subset_options')
  })

  test('a V2-form combo with no static options means NEEDS_MODELS', () => {
    for (const spec of [
      ['COMBO', { multiselect: false, options: [] }],
      ['COMBO', { remote: { route: '/internal/files/output' } }]
    ]) {
      const verdict = classifyAutoRunnable(
        'LoadImageOutputLike',
        {
          input: { required: { image: spec } },
          output: ['IMAGE'],
          output_node: false
        },
        SYNTH
      )
      expect(verdict.verdict).toBe('NEEDS_MODELS')
      expect(verdict.reason).toContain('image')
    }
  })

  test('no outputs and not an OUTPUT_NODE means NO_OBSERVABLE_OUTPUT', () => {
    const verdict = classifyAutoRunnable(
      'SideEffectOnly',
      {
        input: { required: { value: ['INT', {}] } },
        output: [],
        output_node: false
      },
      SYNTH
    )
    expect(verdict.verdict).toBe('NO_OBSERVABLE_OUTPUT')
  })

  test('optional socket inputs do not block auto-running', () => {
    const verdict = classifyAutoRunnable(
      'MathWithOptionalAny',
      {
        input: {
          required: { expression: ['STRING', {}] },
          optional: { a: ['*'] }
        },
        output: ['INT', 'FLOAT'],
        output_node: true
      },
      SYNTH
    )
    expect(verdict.verdict).toBe('AUTO_RUNNABLE')
  })

  test('planAutoRuns validates producers against defs and batches runnables', () => {
    const defs = {
      A: {
        input: { required: { v: ['INT', {}] } },
        output: ['INT'],
        output_node: false
      },
      B: {
        input: { required: { x: ['SEGS'] } },
        output: ['SEGS'],
        output_node: false
      },
      C: {
        input: { required: { img: ['IMAGE'] } },
        output: ['IMAGE'],
        output_node: false
      },
      EmptyImage: { input: { required: {} }, output: ['IMAGE'] }
    }
    const verdicts = planAutoRuns(defs, ['A', 'B', 'C'])
    expect(verdicts.map((verdict) => verdict.verdict)).toEqual([
      'AUTO_RUNNABLE',
      'NEEDS_WIRES',
      'CHAINABLE'
    ])
    const batches = batchAutoRunnable(verdicts, 1)
    expect(batches.map((batch) => batch[0].key)).toEqual(['A', 'C'])
  })

  test('production allowed outcomes accept only artifact-proven mechanisms', () => {
    const cases = [
      [
        'ComfyUI-LivePortraitKJ',
        'LivePortraitLoadCropper',
        "EXECUTION_ERROR (LivePortraitLoadCropper: onnxruntime.capi.onnxruntime_pybind11_state.NoSuchFile - [ONNXRuntimeError] : 3 : NO_SUCHFILE : Load model from /app/comfyui/models/liveportrait/landmark.onnx failed:Load model /app/comfyui/models/liveportrait/landmark.onnx failed. File doesn't exist)",
        'NoSuchFile',
        'InvalidArgument'
      ],
      [
        'ComfyUI_LayerStyle_Advance',
        'LayerMask: ObjectDetectorYOLO8',
        'EXECUTION_ERROR (ServiceError - Failed to send prompt request: request returned error status 400: {"error":{"details":"","extra_info":{},"message":"Prompt outputs failed validation","type":"prompt_outputs_failed_validation"},"node_errors":{"221":{"class_type":"LayerMask: ObjectDetectorYOLO8","dependent_outputs":["223"],"errors":[{"details":"yolo_model: \'yolov8s.pt\' is not a valid value","extra_info":{"input_config":null,"input_name":"yolo_model","received_value":"yolov8s.pt"},"message":"Value not in list","type":"value_not_in_list"}]}}})',
        'yolov8s.pt',
        'different.pt'
      ],
      [
        'ComfyUI_LayerStyle_Advance',
        'LayerMask: YoloV8Detect',
        'EXECUTION_ERROR (ServiceError - Failed to send prompt request: request returned error status 400: {"error":{"details":"","extra_info":{},"message":"Prompt outputs failed validation","type":"prompt_outputs_failed_validation"},"node_errors":{"291":{"class_type":"LayerMask: YoloV8Detect","dependent_outputs":["293"],"errors":[{"details":"yolo_model: \'yolov8n.pt\' is not a valid value","extra_info":{"input_config":null,"input_name":"yolo_model","received_value":"yolov8n.pt"},"message":"Value not in list","type":"value_not_in_list"}]}}})',
        'yolov8n.pt',
        'different.pt'
      ],
      [
        'audio-separation-nodes-comfyui',
        'AudioSeparation',
        'EXECUTION_ERROR (AudioSeparation: RuntimeError - Input type (float) and bias type (double) should be the same)',
        'RuntimeError',
        'TypeError'
      ],
      [
        'audio-separation-nodes-comfyui',
        'AudioSpeedShift',
        'EXECUTION_ERROR (AudioSpeedShift: TypeError - Expected complex-valued STFT for phase vocoder, got dtype torch.complex128)',
        'torch.complex128',
        'torch.complex64'
      ],
      [
        'audio-separation-nodes-comfyui',
        'AudioTempoMatch',
        'EXECUTION_ERROR (AudioTempoMatch: TypeError - Expected complex-valued STFT for phase vocoder, got dtype torch.complex128)',
        'torch.complex128',
        'torch.complex64'
      ]
    ] as const

    for (const [pack, node, detail, nearMissFrom, nearMissTo] of cases) {
      const outcomes = AUTO_RUN_ALLOWED_FAILURES[pack]?.[node]?.outcomes
      if (!outcomes)
        throw new Error(`missing allowed outcomes for ${pack}/${node}`)
      expect(matchesAllowedAutoRunOutcome(detail, outcomes)).toBe(true)
      expect(matchesAllowedAutoRunOutcome(detail, outcomes)).toBe(true)
      expect(matchesAllowedAutoRunOutcome('PARTIAL', outcomes)).toBe(false)
      expect(matchesAllowedAutoRunOutcome('TIMEOUT', outcomes)).toBe(false)
      expect(matchesAllowedAutoRunOutcome(`${detail} extra`, outcomes)).toBe(
        false
      )
      expect(
        matchesAllowedAutoRunOutcome(
          detail.replace(nearMissFrom, nearMissTo),
          outcomes
        )
      ).toBe(false)
    }

    const objectDetectorOutcomes =
      AUTO_RUN_ALLOWED_FAILURES.ComfyUI_LayerStyle_Advance[
        'LayerMask: ObjectDetectorYOLO8'
      ].outcomes
    expect(
      matchesAllowedAutoRunOutcome(
        cases[1][2].replace('"221"', '"987"').replace('["223"]', '["989"]'),
        objectDetectorOutcomes
      )
    ).toBe(true)

    const yoloOutcomes =
      AUTO_RUN_ALLOWED_FAILURES.ComfyUI_LayerStyle_Advance[
        'LayerMask: YoloV8Detect'
      ].outcomes
    const yoloFailure = cases[2][2]
    expect(
      matchesAllowedAutoRunOutcome(
        yoloFailure.replace('"291"', '"997"').replace('["293"]', '["999"]'),
        yoloOutcomes
      )
    ).toBe(true)
    expect(
      matchesAllowedAutoRunOutcome(
        yoloFailure.replace(
          '}}})',
          '},"292":{"class_type":"OtherBrokenNode","dependent_outputs":[],"errors":[]}}})'
        ),
        yoloOutcomes
      )
    ).toBe(false)

    const timeoutOutcomes =
      AUTO_RUN_ALLOWED_FAILURES.comfyui_controlnet_aux
        .ExecuteAllControlNetPreprocessors.outcomes
    expect(matchesAllowedAutoRunOutcome('TIMEOUT', timeoutOutcomes)).toBe(true)
    expect(matchesAllowedAutoRunOutcome('TIMEOUT extra', timeoutOutcomes)).toBe(
      false
    )
  })
})
