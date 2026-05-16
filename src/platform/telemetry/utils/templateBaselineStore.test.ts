import { beforeEach, describe, expect, it } from 'vitest'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

import {
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
})
