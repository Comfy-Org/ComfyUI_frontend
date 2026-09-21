import { describe, expect, it } from 'vitest'

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
})
