import { describe, expect, it } from 'vitest'

const modulePath = './templateCustomNodeRequirements'

type CustomNodeRequirementsModule = {
  extractTemplateCustomNodeRequirements: (
    template: unknown
  ) => readonly string[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

function isCustomNodeRequirementsModule(
  value: unknown
): value is CustomNodeRequirementsModule {
  return (
    isRecord(value) &&
    typeof value.extractTemplateCustomNodeRequirements === 'function'
  )
}

async function extractTemplateCustomNodeRequirements(
  template: unknown
): Promise<readonly string[]> {
  try {
    const module: unknown = await import(modulePath)
    if (!isCustomNodeRequirementsModule(module)) return []

    return module.extractTemplateCustomNodeRequirements(template)
  } catch {
    return []
  }
}

describe('extractTemplateCustomNodeRequirements', () => {
  it('preserves package ID spelling, punctuation, casing, and order', async () => {
    const requirements = [
      'ComfyUI-WanVideoWrapper',
      'comfyui-wanvideowrapper',
      'comfyui_controlnet_aux',
      'RES4LYF'
    ]

    expect(
      await extractTemplateCustomNodeRequirements({
        requiresCustomNodes: requirements
      })
    ).toEqual(requirements)
  })

  it('trims package IDs and stably keeps the first duplicate', async () => {
    expect(
      await extractTemplateCustomNodeRequirements({
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

  it('ignores empty and non-string requirement values', async () => {
    expect(
      await extractTemplateCustomNodeRequirements({
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
  ])(
    'returns no requirements for malformed or absent input %j',
    async (input) => {
      expect(await extractTemplateCustomNodeRequirements(input)).toEqual([])
    }
  )
})
