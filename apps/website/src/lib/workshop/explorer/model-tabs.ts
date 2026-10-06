import type { WorkshopModel } from '@/config/models-catalogue'
import { modalityOf, useCasesFor } from '@/config/models-catalogue'
import type { TranslationKey } from '@/i18n/translations'
import type { OpenWeightModel } from './open-weight-models'

export const MODEL_TABS = [
  'all',
  'image',
  'video',
  'audio',
  '3d',
  'edit',
  'upscale',
  'llm',
  'open',
  'partner'
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
  llm: 'workshop.explorer.tabs.llm',
  open: 'workshop.explorer.tabs.open',
  partner: 'workshop.explorer.tabs.partner'
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
    case 'partner':
      return true
    case 'open':
      return false
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

/**
 * Whether an open-weight model belongs under a category tab. All is for what
 * runs here or by API, so a download waits to be searched or asked for.
 */
export function openWeightInTab(
  model: OpenWeightModel,
  tab: ModelTab
): boolean {
  switch (tab) {
    case 'open':
      return true
    case 'all':
    case 'partner':
    case 'llm':
      return false
    case 'edit':
    case 'upscale':
      return model.tasks.includes(tab)
    default:
      return model.modality === MEDIA_OF_TAB[tab]
  }
}
