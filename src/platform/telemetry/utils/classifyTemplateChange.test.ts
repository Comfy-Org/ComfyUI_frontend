import { describe, expect, it } from 'vitest'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

import { classifyTemplateChange } from './classifyTemplateChange'
import type { LiveNodeLookup } from './classifyTemplateChange'

function makeWorkflow(
  nodes: Array<{
    id: number | string
    type: string
    widgets_values?: unknown[]
    inputs?: unknown[]
    outputs?: unknown[]
  }>,
  links: Array<[number, number, number, number, number, string]> = []
): ComfyWorkflowJSON {
  return {
    nodes,
    links,
    groups: [],
    config: {},
    extra: {},
    version: 0.4
  } as unknown as ComfyWorkflowJSON
}

function liveNodes(
  entries: Array<[number | string, Array<{ name?: string; type?: string }>]>
): LiveNodeLookup {
  const map: LiveNodeLookup = new Map()
  for (const [id, widgets] of entries) {
    map.set(id, { widgets })
  }
  return map
}

describe('classifyTemplateChange', () => {
  it('returns unchanged when baseline and current are identical', () => {
    const baseline = makeWorkflow([
      { id: 1, type: 'KSampler', widgets_values: [42, 20, 7.5] }
    ])
    const current = makeWorkflow([
      { id: 1, type: 'KSampler', widgets_values: [42, 20, 7.5] }
    ])

    const result = classifyTemplateChange(
      baseline,
      current,
      liveNodes([[1, [{ name: 'seed' }, { name: 'steps' }, { name: 'cfg' }]]])
    )

    expect(result).toBe('unchanged')
  })

  it('returns seed_only when only a seed-named widget changed', () => {
    const baseline = makeWorkflow([
      { id: 1, type: 'KSampler', widgets_values: [42, 20, 7.5] }
    ])
    const current = makeWorkflow([
      { id: 1, type: 'KSampler', widgets_values: [99, 20, 7.5] }
    ])

    const result = classifyTemplateChange(
      baseline,
      current,
      liveNodes([[1, [{ name: 'seed' }, { name: 'steps' }, { name: 'cfg' }]]])
    )

    expect(result).toBe('seed_only')
  })

  it('returns seed_only for a widget named noise_seed', () => {
    const baseline = makeWorkflow([
      { id: 7, type: 'SamplerCustom', widgets_values: [123] }
    ])
    const current = makeWorkflow([
      { id: 7, type: 'SamplerCustom', widgets_values: [456] }
    ])

    const result = classifyTemplateChange(
      baseline,
      current,
      liveNodes([[7, [{ name: 'noise_seed' }]]])
    )

    expect(result).toBe('seed_only')
  })

  it('returns prompt_only when only a text-named widget changed', () => {
    const baseline = makeWorkflow([
      { id: 2, type: 'CLIPTextEncode', widgets_values: ['a cat'] }
    ])
    const current = makeWorkflow([
      { id: 2, type: 'CLIPTextEncode', widgets_values: ['a dog'] }
    ])

    const result = classifyTemplateChange(
      baseline,
      current,
      liveNodes([[2, [{ name: 'text' }]]])
    )

    expect(result).toBe('prompt_only')
  })

  it('detects positive_prompt and negative_prompt as prompt widgets', () => {
    const baseline = makeWorkflow([
      { id: 3, type: 'PromptNode', widgets_values: ['cat', 'blurry'] }
    ])
    const current = makeWorkflow([
      { id: 3, type: 'PromptNode', widgets_values: ['cat', 'low quality'] }
    ])

    const result = classifyTemplateChange(
      baseline,
      current,
      liveNodes([
        [3, [{ name: 'positive_prompt' }, { name: 'negative_prompt' }]]
      ])
    )

    expect(result).toBe('prompt_only')
  })

  it('returns seed_and_prompt when both seed and prompt changed', () => {
    const baseline = makeWorkflow([
      { id: 1, type: 'KSampler', widgets_values: [42] },
      { id: 2, type: 'CLIPTextEncode', widgets_values: ['a cat'] }
    ])
    const current = makeWorkflow([
      { id: 1, type: 'KSampler', widgets_values: [99] },
      { id: 2, type: 'CLIPTextEncode', widgets_values: ['a dog'] }
    ])

    const result = classifyTemplateChange(
      baseline,
      current,
      liveNodes([
        [1, [{ name: 'seed' }]],
        [2, [{ name: 'text' }]]
      ])
    )

    expect(result).toBe('seed_and_prompt')
  })

  it('returns structural when a non-seed/non-prompt widget changed', () => {
    const baseline = makeWorkflow([
      { id: 1, type: 'KSampler', widgets_values: [42, 20, 7.5] }
    ])
    const current = makeWorkflow([
      { id: 1, type: 'KSampler', widgets_values: [42, 30, 7.5] }
    ])

    const result = classifyTemplateChange(
      baseline,
      current,
      liveNodes([[1, [{ name: 'seed' }, { name: 'steps' }, { name: 'cfg' }]]])
    )

    expect(result).toBe('structural')
  })

  it('returns structural when a node is added', () => {
    const baseline = makeWorkflow([{ id: 1, type: 'KSampler' }])
    const current = makeWorkflow([
      { id: 1, type: 'KSampler' },
      { id: 2, type: 'LoadImage' }
    ])

    const result = classifyTemplateChange(
      baseline,
      current,
      liveNodes([
        [1, []],
        [2, []]
      ])
    )

    expect(result).toBe('structural')
  })

  it('returns structural when a node is removed', () => {
    const baseline = makeWorkflow([
      { id: 1, type: 'KSampler' },
      { id: 2, type: 'LoadImage' }
    ])
    const current = makeWorkflow([{ id: 1, type: 'KSampler' }])

    const result = classifyTemplateChange(
      baseline,
      current,
      liveNodes([[1, []]])
    )

    expect(result).toBe('structural')
  })

  it('returns structural when a node type changes for the same id', () => {
    const baseline = makeWorkflow([{ id: 1, type: 'KSampler' }])
    const current = makeWorkflow([{ id: 1, type: 'KSamplerAdvanced' }])

    const result = classifyTemplateChange(
      baseline,
      current,
      liveNodes([[1, []]])
    )

    expect(result).toBe('structural')
  })

  it('returns structural when links change', () => {
    const baseline = makeWorkflow(
      [
        { id: 1, type: 'A' },
        { id: 2, type: 'B' }
      ],
      [[1, 1, 0, 2, 0, 'IMAGE']]
    )
    const current = makeWorkflow(
      [
        { id: 1, type: 'A' },
        { id: 2, type: 'B' }
      ],
      []
    )

    const result = classifyTemplateChange(
      baseline,
      current,
      liveNodes([
        [1, []],
        [2, []]
      ])
    )

    expect(result).toBe('structural')
  })

  it('returns structural when widget values array length differs', () => {
    const baseline = makeWorkflow([
      { id: 1, type: 'KSampler', widgets_values: [42, 20] }
    ])
    const current = makeWorkflow([
      { id: 1, type: 'KSampler', widgets_values: [42, 20, 7.5] }
    ])

    const result = classifyTemplateChange(
      baseline,
      current,
      liveNodes([[1, [{ name: 'seed' }, { name: 'steps' }, { name: 'cfg' }]]])
    )

    expect(result).toBe('structural')
  })

  it('returns structural when widget name cannot be classified', () => {
    const baseline = makeWorkflow([
      { id: 1, type: 'CustomNode', widgets_values: [1] }
    ])
    const current = makeWorkflow([
      { id: 1, type: 'CustomNode', widgets_values: [2] }
    ])

    const result = classifyTemplateChange(
      baseline,
      current,
      liveNodes([[1, [{ name: 'mystery_param' }]]])
    )

    expect(result).toBe('structural')
  })

  it('treats link reordering as unchanged when the link set is equal', () => {
    const baseline = makeWorkflow(
      [
        { id: 1, type: 'A' },
        { id: 2, type: 'B' }
      ],
      [
        [1, 1, 0, 2, 0, 'IMAGE'],
        [2, 1, 1, 2, 1, 'MASK']
      ]
    )
    const current = makeWorkflow(
      [
        { id: 1, type: 'A' },
        { id: 2, type: 'B' }
      ],
      [
        [2, 1, 1, 2, 1, 'MASK'],
        [1, 1, 0, 2, 0, 'IMAGE']
      ]
    )

    const result = classifyTemplateChange(
      baseline,
      current,
      liveNodes([
        [1, []],
        [2, []]
      ])
    )

    expect(result).toBe('unchanged')
  })
})
