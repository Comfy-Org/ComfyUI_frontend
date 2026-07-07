import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import {
  batchAutoRunnable,
  classifyAutoRunnable,
  planAutoRuns
} from '@e2e/fixtures/customNode/autoRun'

test.describe('autoRun classifier', () => {
  test('widget-only node with outputs is runnable via a PreviewAny sink', () => {
    const verdict = classifyAutoRunnable('IntConstant', {
      input: { required: { value: ['INT', { default: 0 }] } },
      output: ['INT'],
      output_node: false
    })
    expect(verdict.verdict).toBe('AUTO_RUNNABLE')
    expect(verdict.needsPreviewSink).toBe(true)
  })

  test('widget-only OUTPUT_NODE runs standalone', () => {
    const verdict = classifyAutoRunnable('ShowValue', {
      input: {
        required: {
          text: ['STRING', {}],
          mode: [['raw value', 'tensor shape']]
        }
      },
      output: [],
      output_node: true
    })
    expect(verdict.verdict).toBe('AUTO_RUNNABLE')
    expect(verdict.needsPreviewSink).toBe(false)
  })

  test('a required socket input means NEEDS_WIRES', () => {
    const verdict = classifyAutoRunnable('VaeDecode', {
      input: { required: { samples: ['LATENT'], vae: ['VAE'] } },
      output: ['IMAGE'],
      output_node: false
    })
    expect(verdict.verdict).toBe('NEEDS_WIRES')
    expect(verdict.reason).toContain('samples')
  })

  test('forceInput STRING is a socket, not a widget', () => {
    const verdict = classifyAutoRunnable('TextSink', {
      input: { required: { text: ['STRING', { forceInput: true }] } },
      output: ['STRING'],
      output_node: true
    })
    expect(verdict.verdict).toBe('NEEDS_WIRES')
  })

  test('an empty required combo means NEEDS_MODELS', () => {
    const verdict = classifyAutoRunnable('CheckpointLoader', {
      input: { required: { ckpt_name: [[]] } },
      output: ['MODEL'],
      output_node: false
    })
    expect(verdict.verdict).toBe('NEEDS_MODELS')
    expect(verdict.reason).toContain('ckpt_name')
  })

  test('no outputs and not an OUTPUT_NODE means NO_OBSERVABLE_OUTPUT', () => {
    const verdict = classifyAutoRunnable('SideEffectOnly', {
      input: { required: { value: ['INT', {}] } },
      output: [],
      output_node: false
    })
    expect(verdict.verdict).toBe('NO_OBSERVABLE_OUTPUT')
  })

  test('optional socket inputs do not block auto-running', () => {
    const verdict = classifyAutoRunnable('MathWithOptionalAny', {
      input: {
        required: { expression: ['STRING', {}] },
        optional: { a: ['*'] }
      },
      output: ['INT', 'FLOAT'],
      output_node: true
    })
    expect(verdict.verdict).toBe('AUTO_RUNNABLE')
  })

  test('planAutoRuns maps keys and batchAutoRunnable chunks only runnables', () => {
    const defs = {
      A: {
        input: { required: { v: ['INT', {}] } },
        output: ['INT'],
        output_node: false
      },
      B: {
        input: { required: { x: ['LATENT'] } },
        output: ['LATENT'],
        output_node: false
      },
      C: {
        input: { required: { v: ['FLOAT', {}] } },
        output: ['FLOAT'],
        output_node: false
      }
    }
    const verdicts = planAutoRuns(defs, ['A', 'B', 'C'])
    expect(verdicts.map((verdict) => verdict.verdict)).toEqual([
      'AUTO_RUNNABLE',
      'NEEDS_WIRES',
      'AUTO_RUNNABLE'
    ])
    const batches = batchAutoRunnable(verdicts, 1)
    expect(batches).toHaveLength(2)
    expect(batches[0][0].key).toBe('A')
  })
})
