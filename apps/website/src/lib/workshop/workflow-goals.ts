import { AudioLines, Box, Image, LayoutGrid, Video } from '@lucide/vue'
import type { Component } from 'vue'

import type { WorkflowWorkshopModel } from '@/config/models-catalogue'
import type { TranslationKey } from '@/i18n/translations'
import type { SidebarChoice } from './sidebar-tab-classes'
import { phraseMatches } from './phrase-search'

export const WORKFLOW_TYPES = ['image', 'video', 'audio', '3d'] as const
type WorkflowType = (typeof WORKFLOW_TYPES)[number]

const typeLabelKey: Record<'all' | WorkflowType, TranslationKey> = {
  all: 'workshop.explorer.tabs.all',
  image: 'workshop.explorer.tabs.image',
  video: 'workshop.explorer.tabs.video',
  audio: 'workshop.explorer.tabs.audio',
  '3d': 'workshop.explorer.tabs.3d'
}

const typeIcon: Record<'all' | WorkflowType, Component> = {
  all: LayoutGrid,
  image: Image,
  video: Video,
  audio: AudioLines,
  '3d': Box
}

export function inWorkflowType(
  model: WorkflowWorkshopModel,
  type: 'all' | WorkflowType
): boolean {
  return type === 'all' || model.modality === type
}

/** The modality sidebar's rows: All, then each output type that lists something. */
export function workflowTypeChoices(
  models: readonly WorkflowWorkshopModel[],
  t: (key: TranslationKey) => string
): SidebarChoice<'all' | WorkflowType>[] {
  const count = (type: 'all' | WorkflowType) =>
    models.filter((model) => inWorkflowType(model, type)).length
  return (['all', ...WORKFLOW_TYPES] as const)
    .map((key) => ({
      key,
      count: count(key),
      label: t(typeLabelKey[key]),
      icon: typeIcon[key]
    }))
    .filter((choice) => choice.key === 'all' || choice.count > 0)
}

/** Whether a section's full name, in either language, holds every word of the search. */
export function matchesSectionName(
  model: WorkflowWorkshopModel,
  query: string
): boolean {
  return (model.sectionNames ?? []).some((name) => phraseMatches(name, query))
}
