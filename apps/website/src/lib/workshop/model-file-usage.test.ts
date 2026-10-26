import { describe, expect, it } from 'vitest'

import { hubWorkflowsUsingFile } from '@/config/workshop-page-content'
import { workflowModels } from '@/config/workshop-workflow-content'
import { workflowsUsingFile } from './model-file-usage'

const [relight, material] = workflowModels
const workflows = [
  { model: relight, fileSlugs: ['ae', 'clip-l'] },
  { model: material, fileSlugs: ['ae'] }
]

describe('workflowsUsingFile', () => {
  it.for([
    { slug: 'ae', uses: [relight, material] },
    { slug: 'clip-l', uses: [relight] },
    { slug: 't5xxl-fp16', uses: [] }
  ])('lists the workflows that load $slug', ({ slug, uses }) => {
    expect(workflowsUsingFile(slug, workflows)).toEqual(uses)
  })
})

describe('hubWorkflowsUsingFile', () => {
  it('finds the Hub workflows whose nodes load the file', () => {
    expect(
      hubWorkflowsUsingFile('qwen-image-vae').map(({ slug }) => slug)
    ).toEqual(
      expect.arrayContaining([
        'workflows/change-material',
        'workflows/match-lighting',
        'workflows/new-angle'
      ])
    )
  })

  it('reaches a file loaded under another name through its canonical page', () => {
    expect(
      hubWorkflowsUsingFile('gemma-3-12b-it-fp4-mixed').map(({ slug }) => slug)
    ).toContain('workflows/expand-video-frame')
  })

  it('lists nothing for a file no workflow loads', () => {
    expect(hubWorkflowsUsingFile('no-such-file')).toEqual([])
  })
})
