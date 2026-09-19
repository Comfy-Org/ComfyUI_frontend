import type { UseCase } from '../../config/models-catalogue'
import type { TranslationKey } from '../../i18n/translations'

export const useCaseLabelKey: Record<
  UseCase | 'all' | 'other',
  TranslationKey
> = {
  all: 'workshop.useCase.all',
  other: 'workshop.sections.otherFormats',
  'generate-images': 'workshop.useCase.generateImages',
  'edit-images': 'workshop.useCase.editImages',
  'generate-videos': 'workshop.useCase.generateVideos',
  'animate-images': 'workshop.useCase.animateImages',
  'edit-videos': 'workshop.useCase.editVideos',
  '3d': 'workshop.useCase.3d',
  audio: 'workshop.useCase.audio',
  text: 'workshop.useCase.text'
}
