import { AudioLines, Box, Image, LayoutGrid, Video } from '@lucide/vue'
import type { Component } from 'vue'

import type { WorkflowWorkshopModel } from '@/config/models-catalogue'
import type { TranslationKey } from '@/i18n/translations'
import type { SidebarChoice } from './sidebar-tab-classes'
import { phraseMatches } from './phrase-search'
import type { WorkflowSection } from './workflow-sections'

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

const GOALS = ['characters', 'product', 'upscale', 'cleanup'] as const
type Goal = (typeof GOALS)[number]

const goalLabelKey: Record<Goal, TranslationKey> = {
  characters: 'workshop.workflowGoals.characters',
  product: 'workshop.workflowGoals.product',
  upscale: 'workshop.workflowGoals.upscale',
  cleanup: 'workshop.workflowGoals.cleanup'
}

const MORE_ROW = 'more'

/** Every section a workflow is listed under. */
function sectionsOf(model: WorkflowWorkshopModel): readonly string[] {
  return model.sections ?? (model.section ? [model.section] : [])
}

/**
 * The goal rows in their short-labelled order, each with every workflow
 * listed under it, then the workflows no goal row holds, so none is left out.
 */
export function workflowGoalRows(
  models: readonly WorkflowWorkshopModel[],
  t: (key: TranslationKey) => string
): WorkflowSection[] {
  const rows = GOALS.map((goal) => ({
    id: goal,
    label: t(goalLabelKey[goal]),
    models: models.filter((model) => sectionsOf(model).includes(goal))
  }))
  const placed = new Set(rows.flatMap((row) => row.models))
  return [
    ...rows,
    {
      id: MORE_ROW,
      label: t('workshop.workflowGoals.more'),
      models: models.filter((model) => !placed.has(model))
    }
  ].filter((row) => row.models.length > 0)
}

/** Whether a section's full name, in either language, holds every word of the search. */
export function matchesSectionName(
  model: WorkflowWorkshopModel,
  query: string
): boolean {
  return (model.sectionNames ?? []).some((name) => phraseMatches(name, query))
}
