import { describe, expect, it } from 'vitest'

import { getHubWorkflowPage } from './workflow-detail'
import { workflowDisplayTitle } from './workflow-title'

const titleOf = (name: string) =>
  workflowDisplayTitle(getHubWorkflowPage(name)!.template)

describe('workflowDisplayTitle', () => {
  // The name a person wrote beats anything read off a registry title.
  it('uses the written name where there is one', () => {
    expect(titleOf('utility_nanobanana_pro_product_upscale')).toBe(
      'Sharpen a product photo'
    )
  })

  // The row above a card has already named the job, so what separates one card
  // from the next is the model, and the registry title leads with it.
  it.for([
    ['api_nano_banana_pro', 'Nano Banana Pro'],
    ['api_google_nano_banana2_image_edit', 'Nano Banana 2: Image Edit'],
    ['api_bytedance_seedream_5_0_pro_t2i', 'Seedream 5.0 Pro: Text to Image']
  ] as const)('keeps the registry words for %s', ([name, expected]) => {
    expect(titleOf(name)).toBe(expected)
  })
})
