import { beforeEach, describe, expect, it } from 'vitest'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

import {
  MAX_BASELINES,
  clearTemplateBaselines,
  getTemplateBaseline,
  setTemplateBaseline
} from './templateBaselineStore'

function makeWorkflow(seed: number): ComfyWorkflowJSON {
  return {
    nodes: [{ id: 1, type: 'KSampler', widgets_values: [seed] }],
    links: [],
    groups: [],
    config: {},
    extra: {},
    version: 0.4
  } as unknown as ComfyWorkflowJSON
}

describe('templateBaselineStore', () => {
  beforeEach(() => {
    clearTemplateBaselines()
  })

  it('stores and retrieves a baseline by workflow name', () => {
    const workflow = makeWorkflow(42)
    setTemplateBaseline('flux-dev', workflow)

    const retrieved = getTemplateBaseline('flux-dev')

    expect(retrieved).toEqual(workflow)
  })

  it('returns undefined for unknown workflow names', () => {
    expect(getTemplateBaseline('does-not-exist')).toBeUndefined()
  })

  it('deep-clones stored baselines so mutations to the source do not leak', () => {
    const workflow = makeWorkflow(42)
    setTemplateBaseline('flux-dev', workflow)

    workflow.nodes[0].widgets_values = [999]

    const retrieved = getTemplateBaseline('flux-dev')

    expect(retrieved?.nodes[0].widgets_values).toEqual([42])
  })

  it('replaces an existing baseline when set again with the same name', () => {
    setTemplateBaseline('flux-dev', makeWorkflow(1))
    setTemplateBaseline('flux-dev', makeWorkflow(2))

    expect(getTemplateBaseline('flux-dev')?.nodes[0].widgets_values).toEqual([
      2
    ])
  })

  it('ignores empty workflow names', () => {
    setTemplateBaseline('', makeWorkflow(1))
    expect(getTemplateBaseline('')).toBeUndefined()
  })

  it('returns a defensive clone so callers cannot mutate the stored baseline', () => {
    setTemplateBaseline('flux-dev', makeWorkflow(42))

    const first = getTemplateBaseline('flux-dev')
    expect(first).toBeDefined()
    first!.nodes[0].widgets_values = [999]

    const second = getTemplateBaseline('flux-dev')
    expect(second?.nodes[0].widgets_values).toEqual([42])
  })

  it('evicts the oldest baseline when MAX_BASELINES is exceeded', () => {
    for (let i = 0; i < MAX_BASELINES; i++) {
      setTemplateBaseline(`template-${i}`, makeWorkflow(i))
    }

    setTemplateBaseline('overflow', makeWorkflow(999))

    expect(getTemplateBaseline('template-0')).toBeUndefined()
    expect(getTemplateBaseline('template-1')?.nodes[0].widgets_values).toEqual([
      1
    ])
    expect(getTemplateBaseline('overflow')?.nodes[0].widgets_values).toEqual([
      999
    ])
  })

  it('refreshes recency when re-setting an existing key', () => {
    for (let i = 0; i < MAX_BASELINES; i++) {
      setTemplateBaseline(`template-${i}`, makeWorkflow(i))
    }

    setTemplateBaseline('template-0', makeWorkflow(1000))
    setTemplateBaseline('overflow', makeWorkflow(999))

    expect(getTemplateBaseline('template-0')?.nodes[0].widgets_values).toEqual([
      1000
    ])
    expect(getTemplateBaseline('template-1')).toBeUndefined()
    expect(getTemplateBaseline('overflow')?.nodes[0].widgets_values).toEqual([
      999
    ])
  })
})
