import { describe, expect, it } from 'vitest'

import { getHubWorkflowPage } from './workflow-detail'
import { workflowDisplayTitle } from './workflow-title'

const titleOf = (name: string) => {
  const page = getHubWorkflowPage(name)!
  return workflowDisplayTitle(page.template, page.useCase)
}

describe('workflowDisplayTitle', () => {
  // The names a person wrote for the discovery prototype beat anything read
  // off a registry title, whatever that title says.
  it.for([
    ['image_qwen_image_edit_2511', 'Change a material'],
    ['video_wan_animate2', 'Copy movement from a video'],
    ['utility_seedvr2_3b_int8_upscale_video', 'Upscale a video']
  ] as const)('uses the written name for %s', ([name, expected]) => {
    expect(titleOf(name)).toBe(expected)
  })

  // The registry writes "<model>: <operation>", so the name says which model
  // runs before it says what the reader gets.
  it.for([
    ['api_nano_banana_pro', 'Edit images with Nano Banana Pro'],
    ['video_minimax_h3_i2v', 'Image to video with MiniMax H3']
  ] as const)('puts the job first in %s', ([name, expected]) => {
    expect(titleOf(name)).toBe(expected)
  })

  // A title the rules have nothing better than keeps the registry's words
  // rather than being rewritten into a guess.
  it('keeps a registry title it cannot improve on', () => {
    expect(titleOf('api_minimax_h3_max_i2v')).toBe(
      'MiniMax H3 Max: Image to Video'
    )
  })
})
