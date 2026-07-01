import { describe, expect, it, vi } from 'vitest'

import {
  applyInputOverrides,
  buildOutputAssets,
  waitForPromptOutputs
} from './runApiWorkflow'
import type { ApiPrompt } from './runApiWorkflow'

describe('applyInputOverrides', () => {
  it('writes payload values onto the mapped node inputs', () => {
    const output: ApiPrompt = {
      '7': { inputs: { text: 'old' } },
      '70': { inputs: { seed: 0 } }
    }
    applyInputOverrides(
      output,
      { prompt: 'hello', seed: 42 },
      {
        prompt: { nodeId: '7', widgetName: 'text' },
        seed: { nodeId: '70', widgetName: 'seed' }
      }
    )
    expect(output['7'].inputs.text).toBe('hello')
    expect(output['70'].inputs.seed).toBe(42)
  })

  it('ignores unknown fields and undefined values', () => {
    const output: ApiPrompt = { '7': { inputs: { text: 'keep' } } }
    applyInputOverrides(
      output,
      { unknown: 'x', text: undefined },
      { text: { nodeId: '7', widgetName: 'text' } }
    )
    expect(output['7'].inputs.text).toBe('keep')
  })
})

describe('buildOutputAssets', () => {
  const viewUrl = (filename: string, subfolder: string, type: string) =>
    `http://host/view?filename=${filename}&subfolder=${subfolder}&type=${type}`

  it('builds asset URLs limited to the selected outputs', () => {
    const history = {
      '9': { images: [{ filename: 'a.png', subfolder: '', type: 'output' }] },
      '12': {
        images: [{ filename: 'b.png', subfolder: 'sub', type: 'output' }]
      }
    }
    const result = buildOutputAssets(history, ['9'], viewUrl)
    expect(Object.keys(result)).toEqual(['9'])
    expect(result['9'][0]).toEqual({
      filename: 'a.png',
      subfolder: '',
      type: 'output',
      url: 'http://host/view?filename=a.png&subfolder=&type=output'
    })
  })

  it('falls back to all output nodes when none are selected', () => {
    const history = {
      '9': { images: [{ filename: 'a.png', subfolder: '', type: 'output' }] }
    }
    const result = buildOutputAssets(history, [], viewUrl)
    expect(Object.keys(result)).toEqual(['9'])
  })
})

describe('waitForPromptOutputs', () => {
  it('returns outputs once the history entry has them', async () => {
    const fetchApi = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 'p-1': { outputs: {} } })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          'p-1': { outputs: { '9': { images: [{ filename: 'a.png' }] } } }
        })
      })

    const outputs = await waitForPromptOutputs('p-1', fetchApi, {
      intervalMs: 0,
      timeoutMs: 1000
    })
    expect(outputs).toEqual({ '9': { images: [{ filename: 'a.png' }] } })
    expect(fetchApi).toHaveBeenCalledWith('/history/p-1')
  })

  it('throws when the workflow errors', async () => {
    const fetchApi = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ 'p-1': { status: { status_str: 'error' } } })
    })
    await expect(
      waitForPromptOutputs('p-1', fetchApi, { intervalMs: 0, timeoutMs: 1000 })
    ).rejects.toThrow('Workflow execution failed')
  })

  it('throws on timeout', async () => {
    const fetchApi = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({}) })
    await expect(
      waitForPromptOutputs('p-1', fetchApi, { intervalMs: 0, timeoutMs: 5 })
    ).rejects.toThrow('Timed out')
  })
})
