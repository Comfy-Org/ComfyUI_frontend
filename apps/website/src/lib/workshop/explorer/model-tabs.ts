import type { UseCase, WorkshopModel } from '@/config/models-catalogue'
import { modalityOf, useCasesFor } from '@/config/models-catalogue'
import type { TranslationKey } from '@/i18n/translations'

export const MODEL_TABS = [
  'all',
  'image',
  'video',
  'audio',
  '3d',
  'edit',
  'upscale',
  'llm'
] as const
export type ModelTab = (typeof MODEL_TABS)[number]

export const MODEL_TAB_PARAM = 'tab'

export const modelTabLabelKey: Record<ModelTab, TranslationKey> = {
  all: 'workshop.explorer.tabs.all',
  image: 'workshop.explorer.tabs.image',
  video: 'workshop.explorer.tabs.video',
  audio: 'workshop.explorer.tabs.audio',
  '3d': 'workshop.explorer.tabs.3d',
  edit: 'workshop.explorer.tabs.edit',
  upscale: 'workshop.explorer.tabs.upscale',
  llm: 'workshop.explorer.tabs.llm'
}

/** The tasks a tab splits into; a tab that is already one task has none. */
const tabUseCases: Partial<Record<ModelTab, readonly UseCase[]>> = {
  all: [
    'generate-images',
    'edit-images',
    'generate-videos',
    'animate-images',
    'edit-videos',
    'audio',
    '3d',
    'text'
  ],
  image: ['generate-images', 'edit-images'],
  video: ['generate-videos', 'animate-images', 'edit-videos'],
  edit: ['edit-images', 'edit-videos']
}

const TAB_OF_USE_CASE: Record<UseCase, ModelTab> = {
  'generate-images': 'image',
  'edit-images': 'image',
  'generate-videos': 'video',
  'animate-images': 'video',
  'edit-videos': 'video',
  audio: 'audio',
  '3d': '3d',
  text: 'llm'
}

export function useCasesInTab(
  selected: readonly UseCase[],
  tab: ModelTab
): UseCase[] {
  const offered = tabUseCases[tab] ?? []
  return selected.filter((useCase) => offered.includes(useCase))
}

/**
 * The tab a selection belongs on: the one named, while that type offers every
 * chosen use case, else the one type all of them share. A selection spread
 * over several types stays where it is.
 */
export function tabForUseCases(
  selected: readonly UseCase[],
  named: ModelTab
): ModelTab {
  if (
    named !== 'all' &&
    useCasesInTab(selected, named).length === selected.length
  )
    return named
  const tabs = new Set(selected.map((useCase) => TAB_OF_USE_CASE[useCase]))
  return tabs.size === 1 ? [...tabs][0] : named
}

const MEDIA_OF_TAB = {
  image: 'image',
  video: 'video',
  audio: 'audio',
  '3d': '3d',
  llm: 'text'
} as const satisfies Partial<Record<ModelTab, string>>

const EDIT_CAPABILITIES = [
  'edit',
  'image-edit',
  'video-edit',
  'inpaint',
  'outpaint'
]

function hasCapability(model: WorkshopModel, wanted: readonly string[]) {
  return model.capabilities.some((capability) =>
    wanted.includes(capability.toLowerCase())
  )
}

export function parseModelTab(search: string): ModelTab {
  const value = new URLSearchParams(search).get(MODEL_TAB_PARAM)
  return MODEL_TABS.find((tab) => tab === value) ?? 'all'
}

function hostedEdits(model: WorkshopModel): boolean {
  return (
    useCasesFor(model).some(
      (useCase) => useCase === 'edit-images' || useCase === 'edit-videos'
    ) || hasCapability(model, EDIT_CAPABILITIES)
  )
}

/** Whether a hosted (partner API) model belongs under a category tab. */
export function hostedInTab(model: WorkshopModel, tab: ModelTab): boolean {
  switch (tab) {
    case 'all':
      return true
    case 'edit':
      return hostedEdits(model)
    case 'upscale':
      return hasCapability(model, ['upscale'])
    default:
      return (model.modalities ?? [modalityOf(model)]).includes(
        MEDIA_OF_TAB[tab]
      )
  }
}
