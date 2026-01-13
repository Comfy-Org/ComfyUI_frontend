/**
 * Cloud: Fetches workflow by prompt_id. Desktop: Returns undefined (workflows already in history).
 */
import { isCloud } from '@/platform/distribution/types'

import { getWorkflowFromHistory as cloudImpl } from './getWorkflowFromHistory'

export const getWorkflowFromHistory = isCloud
  ? cloudImpl
  : async () => undefined
