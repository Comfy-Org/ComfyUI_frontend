import type { PromptResponse } from '@comfyorg/ingest-types'

import { FIRST_RUN_SUGGESTIONS } from '@/renderer/extensions/firstRunTour/nudge/firstRunNudgeSuggestions'
import type { SupportedTemplateId } from '@/renderer/extensions/firstRunTour/roles/tourRolePins'

import type { TemplateMediaInfo } from '@/platform/workflow/templates/types/template'
import type { ResultItem } from '@/schemas/apiSchema'

import { makeTemplate } from '@e2e/fixtures/data/templateFixtures'

/**
 * The template both first-run suites tour. Typed against the pin table so
 * dropping it from `TOUR_ROLE_PINS` fails to compile rather than leaving the
 * suites waiting on a tour that can no longer resolve any roles.
 */
export const FIRST_RUN_START_TEMPLATE_ID: SupportedTemplateId =
  'image_z_image_turbo'

export const FIRST_RUN_JOB_ID = 'post-first-run-continuation'

/** A prompt the queue accepts, so a walk does not depend on the backend's models. */
export function queuedPrompt(jobId: string) {
  return {
    prompt_id: jobId,
    number: 1,
    node_errors: {}
  } satisfies PromptResponse
}

/**
 * The image input each continuation declares, pointing at the node the
 * `widgets/load_image_widget` asset carries so the seeded value is readable
 * off the loaded graph.
 */
export const CONTINUATION_INPUT = {
  nodeId: 10,
  nodeType: 'LoadImage',
  file: 'example.png',
  mediaType: 'image'
} satisfies TemplateMediaInfo

/**
 * Every continuation carries the `io` metadata the card's dead-end filter
 * demands, so an action missing from the card means the handoff broke rather
 * than the fixture being thin.
 */
export const FIRST_RUN_TEMPLATES = [
  makeTemplate({
    name: FIRST_RUN_START_TEMPLATE_ID,
    title: 'Z-Image Turbo'
  }),
  ...FIRST_RUN_SUGGESTIONS.map(({ templateId }) =>
    makeTemplate({
      name: templateId,
      io: { inputs: [CONTINUATION_INPUT] }
    })
  )
]

export const FIRST_RUN_OUTPUT = {
  filename: 'first-run-output.webp',
  subfolder: '',
  type: 'output'
} satisfies ResultItem

export const FIRST_RUN_OUTPUT_WIDGET_VALUE = 'first-run-output.webp [output]'
