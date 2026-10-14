import type { WorkflowWorkshopModel } from '@/config/models-catalogue'
import type { TranslationKey } from '@/i18n/translations'
import type { HubTask } from './hub-tasks'
import { HUB_TASKS, hubTaskOf } from './hub-tasks'
import type { SidebarChoice } from './sidebar-tab-classes'
import {
  WORKFLOW_TYPES,
  inWorkflowType,
  workflowTypeChoices
} from './workflow-goals'

type WorkflowType = (typeof WORKFLOW_TYPES)[number]
type TypeTask = `${WorkflowType}:${HubTask}`
export type ModalityTaskKey = 'all' | WorkflowType | TypeTask

/** Every key the sidebar can hold, so an address naming one can be checked. */
export const MODALITY_TASK_KEYS: readonly ModalityTaskKey[] = [
  ...WORKFLOW_TYPES,
  ...WORKFLOW_TYPES.flatMap((type) =>
    HUB_TASKS.map((task): TypeTask => `${type}:${task}`)
  )
]

// Under a type the type is already said, so a task reads as its verb alone.
const taskLabelKey: Record<HubTask, TranslationKey> = {
  'generate-images': 'workshop.useCaseOption.generate',
  'edit-images': 'workshop.useCaseOption.edit',
  'generate-videos': 'workshop.useCaseOption.generate',
  'animate-images': 'workshop.taskSidebar.imageToVideo',
  'edit-videos': 'workshop.useCaseOption.edit',
  upscale: 'workshop.explorer.tabs.upscale',
  audio: 'workshop.explorer.tabs.audio'
}

function split(key: ModalityTaskKey): {
  type: 'all' | WorkflowType
  task?: HubTask
} {
  const [type, task] = key.split(':') as ['all' | WorkflowType, HubTask?]
  return { type, task }
}

export function inModalityTask(
  model: WorkflowWorkshopModel,
  key: ModalityTaskKey
): boolean {
  const { type, task } = split(key)
  return inWorkflowType(model, type) && (!task || hubTaskOf(model) === task)
}

/**
 * The sidebar rows: All, then each output type that lists something. The
 * chosen type opens into its tasks, listed right under it, while it holds
 * more than one.
 */
export function modalityTaskChoices(
  models: readonly WorkflowWorkshopModel[],
  selected: ModalityTaskKey,
  t: (key: TranslationKey) => string
): SidebarChoice<ModalityTaskKey>[] {
  const open = split(selected).type
  return workflowTypeChoices(models, t).flatMap(
    (choice): SidebarChoice<ModalityTaskKey>[] => {
      if (choice.key === 'all' || choice.key !== open) return [choice]
      const listed = models.filter((model) => inWorkflowType(model, open))
      const tasks = HUB_TASKS.map((task) => ({
        key: `${open}:${task}` as const,
        label: t(taskLabelKey[task]),
        count: listed.filter((model) => hubTaskOf(model) === task).length,
        nested: true
      })).filter((task) => task.count > 0)
      return tasks.length > 1 ? [choice, ...tasks] : [choice]
    }
  )
}

/** Whether the sidebar offers `key` for these workflows. */
export function modalityTaskShown(
  models: readonly WorkflowWorkshopModel[],
  key: ModalityTaskKey
): boolean {
  return models.some((model) => inModalityTask(model, key))
}

export const WORKFLOW_COLLECTIONS = ['characters', 'product'] as const
export type WorkflowCollection = (typeof WORKFLOW_COLLECTIONS)[number]

const collectionLabelKey: Record<WorkflowCollection, TranslationKey> = {
  characters: 'workshop.workflowGoals.characters',
  product: 'workshop.workflowGoals.product'
}

export function inCollection(
  model: WorkflowWorkshopModel,
  collection: 'all' | WorkflowCollection
): boolean {
  return (
    collection === 'all' ||
    (model.sections ?? (model.section ? [model.section] : [])).includes(
      collection
    )
  )
}

export interface CollectionChip {
  readonly key: WorkflowCollection
  readonly label: string
  readonly count: number
}

/** The collections that hold any of these workflows, with how many. */
export function collectionChips(
  models: readonly WorkflowWorkshopModel[],
  t: (key: TranslationKey) => string
): CollectionChip[] {
  return WORKFLOW_COLLECTIONS.map((key) => ({
    key,
    label: t(collectionLabelKey[key]),
    count: models.filter((model) => inCollection(model, key)).length
  })).filter((chip) => chip.count > 0)
}
