import { describe, expect, it } from 'vitest'

import { resolveEssentialsDisplayName } from '@/constants/essentialsDisplayNames'

describe('resolveEssentialsDisplayName', () => {
  describe('exact name matches', () => {
    it.each([
      ['LoadImage', 'Load Image'],
      ['SaveImage', 'Save Image'],
      ['CLIPTextEncode', 'Text'],
      ['ImageScale', 'Resize Image'],
      ['LoraLoader', 'Load style (LoRA)'],
      ['OpenAIChatNode', 'Text generation (LLM)'],
      ['RecraftRemoveBackgroundNode', 'Remove Background'],
      ['TencentTextToModelNode', 'Text to 3D model'],
      ['StabilityTextToAudio', 'Music generation'],
      ['image compare', 'Image compare']
    ])('%s -> %s', (name, expected) => {
      expect(resolveEssentialsDisplayName({ name })).toBe(expected)
    })
  })

  describe('blueprint prefix matches', () => {
    it.each([
      ['SubgraphBlueprint.text_to_image_flux_schnell.json', 'Text to image'],
      ['SubgraphBlueprint.text_to_image_sd15.json', 'Text to image'],
      ['SubgraphBlueprint.image_edit_something.json', 'Image to image'],
      ['SubgraphBlueprint.pose_to_image_v2.json', 'Pose to image'],
      [
        'SubgraphBlueprint.canny_to_image_z_image_turbo.json',
        'Canny to image'
      ],
      [
        'SubgraphBlueprint.depth_to_image_z_image_turbo.json',
        'Depth to image'
      ],
      ['SubgraphBlueprint.text_to_video_ltx.json', 'Text to video'],
      ['SubgraphBlueprint.image_to_video_wan.json', 'Image to video'],
      ['SubgraphBlueprint.pose_to_video_ltx_2_0.json', 'Pose to video'],
      ['SubgraphBlueprint.canny_to_video_ltx_2_0.json', 'Canny to video'],
      ['SubgraphBlueprint.depth_to_video_ltx_2_0.json', 'Depth to video'],
      [
        'SubgraphBlueprint.image_inpainting_qwen_image_instantx.json',
        'Inpaint image'
      ],
      [
        'SubgraphBlueprint.image_outpainting_qwen_image_instantx.json',
        'Outpaint image'
      ]
    ])('%s -> %s', (name, expected) => {
      expect(resolveEssentialsDisplayName({ name })).toBe(expected)
    })
  })

  describe('unmapped nodes', () => {
    it('returns undefined for unknown node names', () => {
      expect(resolveEssentialsDisplayName({ name: 'SomeRandomNode' })).toBe(
        undefined
      )
    })

    it('returns undefined for unknown blueprint prefixes', () => {
      expect(
        resolveEssentialsDisplayName({
          name: 'SubgraphBlueprint.unknown_workflow.json'
        })
      ).toBe(undefined)
    })
  })
})
