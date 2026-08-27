import type { PromptResponse } from '@comfyorg/ingest-types'

import type { AssetResponse } from '@/platform/assets/schemas/assetSchema'
import type { RemoteConfig } from '@/platform/remoteConfig/types'
import type { BillingStatusResponse } from '@/platform/workspace/api/workspaceApi'
import type { ResultItem } from '@/schemas/apiSchema'

import { makeTemplate } from '@e2e/fixtures/data/templateFixtures'

export const FIRST_RUN_START_TEMPLATE_ID = 'image_z_image_turbo'
export const FIRST_RUN_JOB_ID = 'post-first-run-continuation'

export const FIRST_RUN_NUDGE_ACTIONS = [
  {
    id: 'animate',
    title: 'Animate it',
    templateId: 'video_minimax_h3_i2v_continuation'
  },
  {
    id: 'upscale',
    title: 'Upscale it',
    templateId: 'utility_seedvr2_7b_int8_upscale_image'
  },
  {
    id: 'restyle',
    title: 'Restyle with Nano Banana',
    templateId: 'api_google_nano_banana2_image_edit_continuation'
  }
] as const

export type FirstRunNudgeAction = (typeof FIRST_RUN_NUDGE_ACTIONS)[number]['id']

const continuationInput = {
  nodeId: 10,
  nodeType: 'LoadImage',
  file: 'example.png',
  mediaType: 'image'
}

export const FIRST_RUN_TEMPLATES = [
  makeTemplate({
    name: FIRST_RUN_START_TEMPLATE_ID,
    title: 'Z-Image Turbo'
  }),
  ...FIRST_RUN_NUDGE_ACTIONS.map(({ templateId, title }) =>
    makeTemplate({
      name: templateId,
      title,
      io: { inputs: [continuationInput] }
    })
  )
]

export const FIRST_RUN_FEATURE_FLAGS = {
  onboarding_tour_enabled: true,
  subscription_required: true
} satisfies RemoteConfig

export const ACTIVE_FIRST_RUN_SUBSCRIPTION = {
  is_active: true,
  max_seats: 1,
  occupied_seats: 1,
  team_credit_stop: null,
  subscription_tier: 'PRO',
  subscription_duration: 'MONTHLY',
  renewal_date: '2099-01-01',
  has_funds: true
} satisfies BillingStatusResponse

export const QUEUED_FIRST_RUN_PROMPT = {
  prompt_id: FIRST_RUN_JOB_ID,
  number: 1,
  node_errors: {}
} satisfies PromptResponse

export const FIRST_RUN_OUTPUT = {
  filename: 'first-run-output.webp',
  subfolder: '',
  type: 'output'
} satisfies ResultItem

export const FIRST_RUN_ASSETS = {
  assets: [
    {
      id: 'first-run-output',
      name: 'First run output.webp',
      hash: FIRST_RUN_OUTPUT.filename,
      mime_type: 'image/webp',
      tags: ['output'],
      created_at: '2026-08-27T12:00:00Z',
      updated_at: '2026-08-27T12:00:00Z'
    }
  ],
  total: 1,
  has_more: false
} satisfies AssetResponse

export const FIRST_RUN_OUTPUT_WIDGET_VALUE = 'first-run-output.webp [output]'
