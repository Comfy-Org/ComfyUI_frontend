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

interface TabUseCase {
  readonly useCase: UseCase
  readonly labelKey: TranslationKey
}

/** The tasks a tab splits into; a tab that is already one task has none. */
export const tabUseCases: Partial<Record<ModelTab, readonly TabUseCase[]>> = {
  image: [
    { useCase: 'generate-images', labelKey: 'workshop.useCaseChip.generate' },
    { useCase: 'edit-images', labelKey: 'workshop.useCaseChip.edit' }
  ],
  video: [
    { useCase: 'generate-videos', labelKey: 'workshop.useCaseChip.generate' },
    {
      useCase: 'animate-images',
      labelKey: 'workshop.useCaseChip.animateImage'
    },
    { useCase: 'edit-videos', labelKey: 'workshop.useCaseChip.editVideo' }
  ],
  edit: [
    { useCase: 'edit-images', labelKey: 'workshop.useCaseChip.images' },
    { useCase: 'edit-videos', labelKey: 'workshop.useCaseChip.videos' }
  ]
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
  return selected.filter((useCase) =>
    offered.some((entry) => entry.useCase === useCase)
  )
}

/**
 * The tab a deep-linked selection opens on: the one named, while it offers
 * every chosen use case, else the one a lone use case belongs to.
 */
export function tabForUseCases(
  selected: readonly UseCase[],
  named: ModelTab
): ModelTab {
  if (useCasesInTab(selected, named).length === selected.length) return named
  return selected.length === 1 ? TAB_OF_USE_CASE[selected[0]] : named
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
