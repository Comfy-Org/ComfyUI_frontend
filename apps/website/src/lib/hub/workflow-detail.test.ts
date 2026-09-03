import { describe, expect, it } from 'vitest'

import {
  getHubWorkflowPage,
  hubWorkflowPath,
  listHubWorkflows
} from './workflow-detail'

describe('getHubWorkflowPage', () => {
  it('returns nothing for an unknown template', () => {
    expect(getHubWorkflowPage('no-such-template')).toBeUndefined()
  })

  it('adapts an image-to-video template into a video playground', () => {
    const page = getHubWorkflowPage('video_minimax_h3_i2v')!
    expect(page.mediaType).toBe('video')
    expect(page.model.modality).toBe('video')
    expect(page.model.href).toBe(hubWorkflowPath('video_minimax_h3_i2v'))
    expect(page.model.fields.map((field) => field.name)).toEqual([
      'prompt',
      'image',
      'aspect_ratio',
      'resolution',
      'duration',
      'seed'
    ])
    expect(page.inputs).toContainEqual({ name: 'image', type: 'file' })
    expect(page.outputs[0]).toEqual({ name: 'video', type: 'mp4' })
    expect(page.stats.cloneCredits).toBeGreaterThanOrEqual(2500)
    expect(page.related).toHaveLength(8)
    expect(page.related.every((other) => !other.isApp)).toBe(true)
    expect(page.related.map((t) => t.name)).not.toContain(
      'video_minimax_h3_i2v'
    )
  })

  it('gives image templates image options and every template a page', () => {
    expect(listHubWorkflows().length).toBeGreaterThan(600)
    const page = getHubWorkflowPage('image_z_image_turbo')!
    expect(page.model.fields.map((field) => field.name)).toContain(
      'output_format'
    )
    expect(page.inputs).toContainEqual({ name: 'n', type: 'int' })
    expect(page.outputs[0].type).toBe('png')
  })
})
