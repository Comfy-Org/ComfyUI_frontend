import { z } from 'astro/zod'
import { describe, expect, it } from 'vitest'

import contractsJson from '../content/workshop-router-contracts.json'
import { workshopModels } from './workshop-browse-content'
import { workshopContractRecordSchema } from './workshop-contract'
import { initialWorkshopPageState } from './workshop-page-state'
import { prepareWorkshopRouterInput } from './workshop-request'
import { getRouterWorkshopModelDetail } from './workshop-router-content'

const MODERATION_CONTROLS = [
  'contentModeration',
  'enable_copyright_detection',
  'enable_safety_checker',
  'ip_signal',
  'moderation',
  'prompt_content_moderation',
  'safetySettings',
  'safety_tolerance',
  'visual_input_content_moderation',
  'visual_output_content_moderation'
]

const contracts = z.array(workshopContractRecordSchema).parse(contractsJson)
const jsonObject = z.record(z.string(), z.json())

const states = workshopModels.flatMap((model) => {
  const detail = getRouterWorkshopModelDetail(model.slug)
  return detail ? [[model.slug, initialWorkshopPageState(detail)] as const] : []
})

function contractFor(id: string) {
  const contract = contracts.find((entry) => entry.id === id)
  if (!contract) throw new Error(`Missing contract: ${id}`)
  return contract
}

describe('provider moderation controls', () => {
  it('reaches no model form', () => {
    const asked = states.flatMap(([slug, state]) =>
      state.schema
        .filter((field) => MODERATION_CONTROLS.includes(field.name))
        .map((field) => `${slug}: ${field.name}`)
    )

    expect(asked).toEqual([])
  })

  it('seeds no editable moderation value', () => {
    const sent = states.flatMap(([slug, state]) =>
      Object.keys(state.values)
        .filter((name) => MODERATION_CONTROLS.includes(name))
        .map((name) => `${slug}: ${name}`)
    )

    expect(sent).toEqual([])
  })

  // Where the safe value came from our own defaultCandidates rather than the
  // provider's declared default, dropping the control would hand the decision
  // back to a provider that defaults the other way. Those stay pinned.
  it.for([
    ['bria/image-edit-erase', 'visual_input_content_moderation', true],
    ['bria/image-edit-erase', 'visual_output_content_moderation', true],
    ['bria/image-edit-expand', 'prompt_content_moderation', true],
    ['bria/image-edit-expand', 'visual_input_content_moderation', true],
    ['bria/image-edit-expand', 'visual_output_content_moderation', true],
    ['bria/image-edit-gen-fill', 'prompt_content_moderation', true],
    ['bria/image-edit-gen-fill', 'visual_input_content_moderation', true],
    ['bria/image-edit-gen-fill', 'visual_output_content_moderation', true],
    [
      'bria/image-edit-increase-resolution',
      'visual_input_content_moderation',
      true
    ],
    [
      'bria/image-edit-increase-resolution',
      'visual_output_content_moderation',
      true
    ],
    [
      'bria/image-edit-remove-background',
      'visual_input_content_moderation',
      true
    ],
    [
      'bria/image-edit-remove-background',
      'visual_output_content_moderation',
      true
    ],
    ['ideogram/ideogram-v4', 'enable_copyright_detection', true],
    ['ideogram/p-image-ideogram', 'enable_copyright_detection', true],
    ['openai/gpt-image-1', 'moderation', 'auto'],
    ['openai/gpt-image-1.5', 'moderation', 'auto'],
    ['openai/gpt-image-2', 'moderation', 'auto'],
    ['openai/gpt-image-2.5-flare', 'moderation', 'auto'],
    ['openai/gpt-image-2.5-sunburst', 'moderation', 'auto']
  ] as const)(
    'keeps sending %s its curated safe value',
    ([id, name, value]) => {
      const contract = contractFor(id)
      expect(contract.defaultInput).toMatchObject({ [name]: value })
    }
  )

  it.for([
    ['bfl/flux-2-max', 'safety_tolerance'],
    ['bria/fibo', 'prompt_content_moderation'],
    ['fal/h3-max', 'enable_safety_checker']
  ] as const)('leaves %s at its endpoint default', ([id, name]) => {
    expect(contractFor(id).defaultInput).not.toHaveProperty(name)
  })

  it('enforces fixed checks in prepared requests', async () => {
    const contract = contractFor('bria/image-edit-expand')
    const example = jsonObject.parse(contract.inputSchema.example)
    const signal = new AbortController().signal

    await expect(
      prepareWorkshopRouterInput(
        contract,
        { request_body: JSON.stringify(example) },
        signal
      )
    ).resolves.toMatchObject({
      prompt_content_moderation: true,
      visual_input_content_moderation: true,
      visual_output_content_moderation: true
    })

    await expect(
      prepareWorkshopRouterInput(
        contract,
        {
          request_body: JSON.stringify({
            ...example,
            visual_output_content_moderation: false
          })
        },
        signal
      )
    ).rejects.toMatchObject({ reason: 'validation' })
  })
})
