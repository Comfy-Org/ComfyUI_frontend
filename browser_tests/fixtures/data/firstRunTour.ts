import type { PromptResponse } from '@comfyorg/ingest-types'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { SupportedTemplateId } from '@/renderer/extensions/firstRunTour/roles/tourRolePins'

import type { TemplateMediaInfo } from '@/platform/workflow/templates/types/template'
import type { ResultItem } from '@/schemas/apiSchema'

import { makeTemplate } from '@e2e/fixtures/data/templateFixtures'

const { nudge } = enMessages.onboardingCoachmarks.firstRun

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
 * The continuations the discovery card offers. Titles come from the locale the
 * card renders from, so a copy change moves both together.
 */
export const FIRST_RUN_NUDGE_ACTIONS = [
  {
    id: 'animate',
    title: nudge.animate.title,
    templateId: 'video_minimax_h3_i2v_continuation'
  },
  {
    id: 'upscale',
    title: nudge.upscale.title,
    templateId: 'utility_seedvr2_7b_int8_upscale_image'
  },
  {
    id: 'restyle',
    title: nudge.restyle.title,
    templateId: 'api_google_nano_banana2_image_edit_continuation'
  }
] as const

export type FirstRunNudgeAction = (typeof FIRST_RUN_NUDGE_ACTIONS)[number]['id']

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

export const FIRST_RUN_TEMPLATES = [
  makeTemplate({
    name: FIRST_RUN_START_TEMPLATE_ID,
    title: 'Z-Image Turbo'
  }),
  ...FIRST_RUN_NUDGE_ACTIONS.map(({ templateId, title }) =>
    makeTemplate({
      name: templateId,
      title,
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
