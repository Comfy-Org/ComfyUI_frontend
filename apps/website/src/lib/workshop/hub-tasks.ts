import type { WorkshopModel } from '@/config/models-catalogue'
import { useCaseFor } from '@/config/models-catalogue'

import { hostedInTab } from './explorer/model-tabs'

export const HUB_TASKS = [
  'generate-images',
  'edit-images',
  'generate-videos',
  'animate-images',
  'edit-videos',
  'upscale',
  'audio'
] as const
export type HubTask = (typeof HUB_TASKS)[number]

const UPSCALE_WORKFLOW_CATEGORY = 'upscale'

function upscales(model: WorkshopModel): boolean {
  return (
    hostedInTab(model, 'upscale') ||
    ((model.type === 'CLOUD' || model.type === 'SERVERLESS') &&
      model.category === UPSCALE_WORKFLOW_CATEGORY)
  )
}

/**
 * The one task an item is listed under: Upscale for an image or video
 * upscaler, else the task its first use case names.
 */
export function hubTaskOf(model: WorkshopModel): HubTask | undefined {
  if (upscales(model)) return 'upscale'
  const useCase = useCaseFor(model)
  return HUB_TASKS.find((task) => task === useCase)
}
