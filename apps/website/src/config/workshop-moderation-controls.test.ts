import { z } from 'astro/zod'
import { describe, expect, it } from 'vitest'

import contractsJson from '../content/workshop-router-contracts.json'
import { workshopContractRecordSchema } from './workshop-contract'
import { workshopModels } from './workshop-browse-content'
import { initialWorkshopPageState } from './workshop-page-state'
import { getRouterWorkshopModelDetail } from './workshop-router-content'

/**
 * Switches that turn a provider's own content checks up or down. Relaxing them
 * is a policy call, not a reader's preference, so the catalogue asks nobody and
 * sends nothing: every provider applies its own default.
 */
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

const states = workshopModels.flatMap((model) => {
  const detail = getRouterWorkshopModelDetail(model.slug)
  return detail ? [[model.slug, initialWorkshopPageState(detail)] as const] : []
})

describe('provider moderation controls', () => {
  it('reaches no model form', () => {
    const asked = states.flatMap(([slug, state]) =>
      state.schema
        .filter((field) => MODERATION_CONTROLS.includes(field.name))
        .map((field) => `${slug}: ${field.name}`)
    )

    expect(asked).toEqual([])
  })

  it('sends no value of its own', () => {
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
      const contract = contracts.find((entry) => entry.id === id)
      if (!contract) throw new Error(`Missing contract: ${id}`)

      expect(contract.defaultInput).toMatchObject({ [name]: value })
    }
  )
})
