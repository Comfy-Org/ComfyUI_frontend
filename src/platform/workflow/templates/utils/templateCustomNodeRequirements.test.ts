import { describe, expect, it } from 'vitest'

import { extractTemplateCustomNodeRequirements } from './templateCustomNodeRequirements'

describe('extractTemplateCustomNodeRequirements', () => {
  it('preserves package ID spelling, punctuation, casing, and order', () => {
    const requirements = [
      'ComfyUI-WanVideoWrapper',
      'comfyui-wanvideowrapper',
      'comfyui_controlnet_aux',
      'RES4LYF'
    ]

    expect(
      extractTemplateCustomNodeRequirements({
        requiresCustomNodes: requirements
      })
    ).toEqual(requirements)
  })

  it('trims package IDs and stably keeps the first duplicate', () => {
    expect(
      extractTemplateCustomNodeRequirements({
        requiresCustomNodes: [
          '  comfyui-kjnodes  ',
          'comfyui_essentials',
          'comfyui-kjnodes',
          '\tcomfyui_essentials\n',
          'was-ns'
        ]
      })
    ).toEqual(['comfyui-kjnodes', 'comfyui_essentials', 'was-ns'])
  })

  it('ignores empty and non-string requirement values', () => {
    expect(
      extractTemplateCustomNodeRequirements({
        requiresCustomNodes: [
          null,
          42,
          {},
          '',
          '   ',
          'comfyui-videohelpersuite'
        ]
      })
    ).toEqual(['comfyui-videohelpersuite'])
  })

  it.for([
    undefined,
    null,
    {},
    { requiresCustomNodes: null },
    { requiresCustomNodes: 'comfyui-kjnodes' }
  ])('returns no requirements for malformed or absent input %j', (input) => {
    expect(extractTemplateCustomNodeRequirements(input)).toEqual([])
  })
})
