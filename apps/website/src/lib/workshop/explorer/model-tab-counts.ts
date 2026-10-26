import { groupModels } from '@/config/model-family'
import type { WorkshopModel } from '@/config/models-catalogue'
import type { TranslationKey } from '@/i18n/translations'
import type { ModelTab } from './model-tabs'
import { hostedInTab, MODEL_TABS } from './model-tabs'

export interface ModelTabGroup {
  readonly titleKey: TranslationKey
  readonly tabs: readonly ModelTab[]
}

const MODEL_TAB_GROUPS: readonly ModelTabGroup[] = [
  {
    titleKey: 'workshop.explorer.tabs.groups.type',
    tabs: ['all', 'image', 'video', 'audio', '3d', 'llm']
  },
  {
    titleKey: 'workshop.explorer.tabs.groups.task',
    tabs: ['edit', 'upscale']
  }
]

export type ModelTabCounts = ReadonlyMap<ModelTab, number>

/** What each tab lists before any search or filter narrows it. */
export function modelTabCounts(
  models: readonly WorkshopModel[]
): ModelTabCounts {
  return new Map(
    MODEL_TABS.map((tab): [ModelTab, number] => [
      tab,
      groupModels(models.filter((model) => hostedInTab(model, tab))).length
    ])
  )
}

/** The groups with only the tabs that list something; a group left bare goes. */
export function shownTabGroups(counts: ModelTabCounts): ModelTabGroup[] {
  return MODEL_TAB_GROUPS.map((group) => ({
    ...group,
    tabs: group.tabs.filter((tab) => (counts.get(tab) ?? 0) > 0)
  })).filter((group) => group.tabs.length > 0)
}
