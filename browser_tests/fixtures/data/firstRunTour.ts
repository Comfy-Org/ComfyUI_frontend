import type { PromptResponse } from '@comfyorg/ingest-types'

import type { AssetResponse } from '@/platform/assets/schemas/assetSchema'
import type { RemoteConfig } from '@/platform/remoteConfig/types'
import type { TemplateMediaInfo } from '@/platform/workflow/templates/types/template'
import type { BillingStatusResponse } from '@/platform/workspace/api/workspaceApi'
import type { SupportedTemplateId } from '@/renderer/extensions/firstRunTour/roles/tourRolePins'
import { TOUR_ROLE_PINS } from '@/renderer/extensions/firstRunTour/roles/tourRolePins'
import type { ResultItem } from '@/schemas/apiSchema'

import { makeTemplate } from '@e2e/fixtures/data/templateFixtures'

export const FIRST_RUN_START_TEMPLATE_ID: SupportedTemplateId =
  'image_z_image_turbo'

export const FIRST_RUN_JOB_ID = 'post-first-run-race'

export const FIRST_RUN_PROMPT = {
  prompt_id: FIRST_RUN_JOB_ID,
  number: 1,
  node_errors: {}
} satisfies PromptResponse

export const CONTINUATION_INPUT = {
  nodeId: 10,
  nodeType: 'LoadImage',
  file: 'example.png',
  mediaType: 'image'
} satisfies TemplateMediaInfo

export const FIRST_RUN_CONTINUATION = {
  action: 'animate',
  templateId: 'video_minimax_h3_i2v_continuation'
}

export const FIRST_RUN_TEMPLATES = [
  makeTemplate({
    name: FIRST_RUN_START_TEMPLATE_ID,
    title: 'Z-Image Turbo'
  }),
  makeTemplate({
    name: FIRST_RUN_CONTINUATION.templateId,
    io: { inputs: [CONTINUATION_INPUT] }
  })
]

export const FIRST_RUN_OUTPUT = {
  filename: 'first-run-final.webp',
  subfolder: '',
  type: 'output'
} satisfies ResultItem

export const FIRST_RUN_INTERMEDIATE_OUTPUT = {
  filename: 'first-run-intermediate.webp',
  subfolder: '',
  type: 'output'
} satisfies ResultItem

export const FIRST_RUN_INTERMEDIATE_NODE_ID = '28'
export const FIRST_RUN_OUTPUT_NODE_ID = String(
  TOUR_ROLE_PINS[FIRST_RUN_START_TEMPLATE_ID].sink.id
)
export const FIRST_RUN_OUTPUT_WIDGET_VALUE = 'first-run-final.webp [output]'

export const FIRST_RUN_FEATURES = {
  onboarding_tour_enabled: true,
  subscription_required: true
} satisfies RemoteConfig

export const FIRST_RUN_BILLING_STATUS = {
  is_active: true,
  max_seats: 1,
  occupied_seats: 1,
  team_credit_stop: null,
  scheduled_change: null,
  subscription_tier: 'PRO',
  subscription_duration: 'MONTHLY',
  renewal_date: '2099-01-01',
  has_funds: true
} satisfies BillingStatusResponse

export const FIRST_RUN_NO_ASSETS = {
  assets: [],
  total: 0,
  has_more: false
} satisfies AssetResponse
