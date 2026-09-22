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

  // A graph that is one partner node between a load and a save is the model,
  // and `Text to Image` was the registry talking to itself. The model leads
  // because it is what tells one of these from the next.
  it.for([
    ['api_bytedance_seedream_5_0_pro_t2i', 'Seedream 5.0 Pro from a prompt'],
    ['api_google_nano_banana2_image_edit', 'Nano Banana 2 on your photo'],
    ['api_seedance2_5_r2v', 'Seedance 2.5 from reference shots']
  ] as const)('names %s after its model and its input', ([name, expected]) => {
    expect(titleOf(name)).toBe(expected)
  })

  // A card the reader cannot tell from its neighbour is a card they have to
  // open to find out, and every one of these is meant to be chosen at a
  // glance.
  it('gives every workflow in the Hub a name of its own', () => {
    const titles = listHubWorkflows().map(workflowDisplayTitle)

    expect(new Set(titles).size).toBe(titles.length)
  })
})
