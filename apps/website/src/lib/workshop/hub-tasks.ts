import type { WorkshopModel } from '@/config/models-catalogue'
import { useCaseFor } from '@/config/models-catalogue'
import {
  AudioLines,
  Columns2,
  Film,
  Image,
  LayoutGrid,
  Pencil,
  Scissors,
  Video
} from '@lucide/vue'
import type { Component } from 'vue'

import type { TranslationKey } from '@/i18n/translations'
import { hostedInTab } from './explorer/model-tabs'
import type { SidebarChoice } from './sidebar-tab-classes'

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

const hubTaskIcon: Record<HubTaskKey, Component> = {
  all: LayoutGrid,
  'generate-images': Image,
  'edit-images': Pencil,
  'generate-videos': Video,
  'animate-images': Film,
  'edit-videos': Scissors,
  upscale: Columns2,
  audio: AudioLines
}

/** The task sidebar's rows: All, then each task that lists something. */
export function hubTaskChoices(
  entries: readonly HubTaskEntry[],
  total: number,
  t: (key: TranslationKey) => string
): SidebarChoice<HubTaskKey>[] {
  return [{ key: 'all' as const, count: total }, ...entries].map((entry) => ({
    ...entry,
    label: t(hubTaskLabelKey[entry.key]),
    icon: hubTaskIcon[entry.key]
  }))
}
