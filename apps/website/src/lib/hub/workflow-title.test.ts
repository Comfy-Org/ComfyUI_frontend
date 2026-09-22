import { describe, expect, it } from 'vitest'

import { listHubWorkflows } from './workflow-detail'
import { workflowDisplayTitle } from './workflow-title'

const titleOf = (name: string) =>
  workflowDisplayTitle(listHubWorkflows().find((t) => t.name === name)!)

describe('workflowDisplayTitle', () => {
  it('names a workflow after the job it does', () => {
    expect(titleOf('utility_nanobanana_pro_product_upscale')).toBe(
      'Sharpen a product photo'
    )
  })

  // A graph that is one partner node between a load and a save still does a
  // job, and the job is what the reader came for. `Text to Image` was the
  // registry talking to itself, and the model rides on its own line.
  it.for([
    ['api_bytedance_seedream_5_0_pro_t2i', 'Create an image from a prompt'],
    ['api_google_nano_banana2_image_edit', 'Edit an image with a prompt'],
    ['api_seedance2_5_r2v', 'Create a video from references']
  ] as const)('names %s after the job, not the model', ([name, expected]) => {
    expect(titleOf(name)).toBe(expected)
  })

  // A name the registry wrote for itself is a name nobody asked for.
  it('leaves no workflow in the Hub with a name nobody wrote', () => {
    const unwritten = listHubWorkflows().filter(
      (template) => workflowDisplayTitle(template) === template.title
    )

    expect(unwritten).toEqual([])
  })
})
