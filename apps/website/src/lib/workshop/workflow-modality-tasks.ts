import type { WorkflowWorkshopModel } from '@/config/models-catalogue'
import type { TranslationKey } from '@/i18n/translations'
import type { HubTask } from './hub-tasks'
import { HUB_TASKS, hubTaskOf } from './hub-tasks'
import type { SidebarChoice } from './sidebar-tab-classes'
import type {
  MockTask,
  WorkflowCollection
} from './workflow-catalogue-mock-data'
import { MOCK_TASKS } from './workflow-catalogue-mock-data'
import {
  WORKFLOW_TYPES,
  inWorkflowType,
  workflowTypeChoices
} from './workflow-goals'

type WorkflowType = (typeof WORKFLOW_TYPES)[number]
type ModalityTask = HubTask | MockTask
type TypeTask = `${WorkflowType}:${ModalityTask}`
export type ModalityTaskKey = 'all' | WorkflowType | TypeTask

const MODALITY_TASKS: readonly ModalityTask[] = [
  ...new Set<ModalityTask>([...HUB_TASKS, ...Object.values(MOCK_TASKS).flat()])
]

/** Every key the sidebar can hold, so an address naming one can be checked. */
export const MODALITY_TASK_KEYS: readonly ModalityTaskKey[] = [
  ...WORKFLOW_TYPES,
  ...WORKFLOW_TYPES.flatMap((type) =>
    MODALITY_TASKS.map((task): TypeTask => `${type}:${task}`)
  )
]

/** How a catalogue sorts its workflows into tasks under each type, and into collections. */
export interface ModalityTaxonomy {
  readonly tasks: (type: WorkflowType) => readonly ModalityTask[]
  readonly taskOf: (model: WorkflowWorkshopModel) => ModalityTask | undefined
  readonly collections: readonly WorkflowCollection[]
  readonly collectionsOf: (model: WorkflowWorkshopModel) => readonly string[]
}

/** The published catalogue's tasks and its two use-case collections. */
export const HUB_TAXONOMY: ModalityTaxonomy = {
  tasks: () => HUB_TASKS,
  taskOf: hubTaskOf,
  collections: ['characters', 'product'],
  collectionsOf: (model) =>
    model.sections ?? (model.section ? [model.section] : [])
}

const taskLabelKey: Record<ModalityTask, TranslationKey> = {
  'generate-images': 'workshop.useCaseOption.generate',
  'edit-images': 'workshop.useCaseOption.edit',
  'generate-videos': 'workshop.useCaseOption.generate',
  'animate-images': 'workshop.taskSidebar.imageToVideo',
  'edit-videos': 'workshop.useCaseOption.edit',
  upscale: 'workshop.explorer.tabs.upscale',
  audio: 'workshop.explorer.tabs.audio',
  generate: 'workshop.useCaseOption.generate',
  edit: 'workshop.useCaseOption.edit',
  control: 'workshop.modalityTasks.control',
  'image-to-video': 'workshop.taskSidebar.imageToVideo',
  'motion-transfer': 'workshop.modalityTasks.motionTransfer',
  'lip-sync': 'workshop.modalityTasks.lipSync',
  speech: 'workshop.modalityTasks.speech',
  music: 'workshop.modalityTasks.music',
  'from-image': 'workshop.modalityTasks.fromImage',
  'from-text': 'workshop.modalityTasks.fromText'
}

function split(key: ModalityTaskKey): {
  type: 'all' | WorkflowType
  task?: ModalityTask
} {
  const [type, task] = key.split(':') as ['all' | WorkflowType, ModalityTask?]
  return { type, task }
}

/** Whether a sidebar key names a task inside a type, not All or a type alone. */
export function namesTask(key: ModalityTaskKey): boolean {
  return split(key).task !== undefined
}

export function inModalityTask(
  model: WorkflowWorkshopModel,
  key: ModalityTaskKey,
  taxonomy: ModalityTaxonomy = HUB_TAXONOMY
): boolean {
  const { type, task } = split(key)
  return (
    inWorkflowType(model, type) && (!task || taxonomy.taskOf(model) === task)
  )
}

/**
 * The sidebar rows: All, then each output type that lists something. The
 * chosen type opens into its tasks, listed right under it, while it holds
 * more than one.
 */
export function modalityTaskChoices(
  models: readonly WorkflowWorkshopModel[],
  selected: ModalityTaskKey,
  t: (key: TranslationKey) => string,
  taxonomy: ModalityTaxonomy = HUB_TAXONOMY
): SidebarChoice<ModalityTaskKey>[] {
  const open = split(selected).type
  return workflowTypeChoices(models, t).flatMap(
    (choice): SidebarChoice<ModalityTaskKey>[] => {
      if (choice.key === 'all' || choice.key !== open) return [choice]
      const listed = models.filter((model) => inWorkflowType(model, open))
      const tasks = taxonomy
        .tasks(open)
        .map((task) => ({
          key: `${open}:${task}` as const,
          label: t(taskLabelKey[task]),
          count: listed.filter((model) => taxonomy.taskOf(model) === task)
            .length,
          nested: true
        }))
        .filter((task) => task.count > 0)
      return tasks.length > 1 ? [choice, ...tasks] : [choice]
    }
  )
}

/** Whether the sidebar offers `key` for these workflows. */
export function modalityTaskShown(
  models: readonly WorkflowWorkshopModel[],
  key: ModalityTaskKey,
  taxonomy: ModalityTaxonomy = HUB_TAXONOMY
): boolean {
  return models.some((model) => inModalityTask(model, key, taxonomy))
}

const collectionLabelKey: Record<WorkflowCollection, TranslationKey> = {
  characters: 'workshop.workflowGoals.characters',
  'game-assets': 'workshop.workflowCollections.gameAssets',
  product: 'workshop.workflowGoals.product',
  architecture: 'workshop.workflowCollections.architecture',
  storyboards: 'workshop.workflowCollections.storyboards',
  anime: 'workshop.workflowCollections.anime'
}

export function inCollection(
  model: WorkflowWorkshopModel,
  collection: 'all' | WorkflowCollection,
  taxonomy: ModalityTaxonomy = HUB_TAXONOMY
): boolean {
  return (
    collection === 'all' || taxonomy.collectionsOf(model).includes(collection)
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
  t: (key: TranslationKey) => string,
  taxonomy: ModalityTaxonomy = HUB_TAXONOMY
): CollectionChip[] {
  return taxonomy.collections
    .map((key) => ({
      key,
      label: t(collectionLabelKey[key]),
      count: models.filter((model) => inCollection(model, key, taxonomy)).length
    }))
    .filter((chip) => chip.count > 0)
}
