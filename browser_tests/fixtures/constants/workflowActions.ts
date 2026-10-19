import type { Settings } from '@/platform/settings/types'
import { DEPLOY_TO_COMFY_API_ACTION_ID } from '@/platform/workflow/deploy/constants'

export const DEPLOY_ACTION_SEEN_SETTINGS = {
  'Comfy.WorkflowActions.SeenItems': [DEPLOY_TO_COMFY_API_ACTION_ID]
} satisfies Partial<Settings>
