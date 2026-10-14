import type { WorkshopModel } from '@/config/models-catalogue'
import { useCaseFor } from '@/config/models-catalogue'
import type { TranslationKey } from '@/i18n/translations'
import { hostedInTab } from './explorer/model-tabs'

const HUB_TASKS = [
  'generate-images',
  'edit-images',
  'generate-videos',
  'animate-images',
  'edit-videos',
  'upscale',
  'audio'
] as const
export type HubTask = (typeof HUB_TASKS)[number]
export type HubTaskKey = 'all' | HubTask

export const hubTaskLabelKey: Record<HubTaskKey, TranslationKey> = {
  all: 'workshop.explorer.tabs.all',
  'generate-images': 'workshop.taskSidebar.generateImages',
  'edit-images': 'workshop.taskSidebar.editImages',
  'generate-videos': 'workshop.taskSidebar.generateVideos',
  'animate-images': 'workshop.taskSidebar.imageToVideo',
  'edit-videos': 'workshop.taskSidebar.editVideos',
  upscale: 'workshop.explorer.tabs.upscale',
  audio: 'workshop.explorer.tabs.audio'
}

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

export function inHubTask(model: WorkshopModel, key: HubTaskKey): boolean {
  return key === 'all' || hubTaskOf(model) === key
}

export interface HubTaskEntry {
  readonly key: HubTask
  readonly count: number
}

/** The tasks that list something, each with how much it lists. */
export function hubTaskEntries<T extends WorkshopModel>(
  models: readonly T[],
  count: (listed: readonly T[]) => number
): HubTaskEntry[] {
  return HUB_TASKS.map((key) => ({
    key,
    count: count(models.filter((model) => hubTaskOf(model) === key))
  })).filter((entry) => entry.count > 0)
}

/** Whether the sidebar offers `key`: All always, a task while it lists something. */
export function hubTaskShown(
  entries: readonly HubTaskEntry[],
  key: HubTaskKey
): boolean {
  return key === 'all' || entries.some((entry) => entry.key === key)
}

const HUB_TASK_PARAM = 'task'

/** The task an address names, as `?task=edit-images`. */
export function parseHubTaskKey(search: string): HubTaskKey {
  const named = new URLSearchParams(search).get(HUB_TASK_PARAM)
  return HUB_TASKS.find((task) => task === named) ?? 'all'
}

export function hubTaskAddress(href: string, key: HubTaskKey): string {
  const url = new URL(href)
  if (key === 'all') url.searchParams.delete(HUB_TASK_PARAM)
  else url.searchParams.set(HUB_TASK_PARAM, key)
  return url.href
}
