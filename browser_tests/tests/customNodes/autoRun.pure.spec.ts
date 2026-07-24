import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import {
  batchAutoRunnable,
  classifyAutoRunnable,
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
})
