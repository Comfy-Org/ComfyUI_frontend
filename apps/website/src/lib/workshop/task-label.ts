import type {
  ModalityFilter,
  TaskInput,
  WorkshopModel
} from '../../config/models-catalogue'
import { modalityOf, splitTask } from '../../config/models-catalogue'
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const modalityLabelKey: Record<
  Exclude<ModalityFilter, 'all'>,
  TranslationKey
> = {
  image: 'workshop.filter.image',
  video: 'workshop.filter.video',
  audio: 'workshop.filter.audio',
  '3d': 'workshop.filter.3d',
  text: 'workshop.filter.text',
  other: 'workshop.filter.other'
}

const taskInputKey: Record<TaskInput, TranslationKey> = {
  text: 'workshop.task.text',
  image: 'workshop.task.image',
  video: 'workshop.task.video',
  audio: 'workshop.task.audio'
}

// "Image to Video" where the schema says what goes in and what comes out, and
// the plain modality where it only says what comes out.
export function taskLabelFor(model: WorkshopModel, locale: Locale): string {
  const task = model.task ? splitTask(model.task) : undefined
  return task && task.output !== 'other'
    ? t('workshop.task.label', locale)
        .replace('{input}', t(taskInputKey[task.input], locale))
        .replace('{output}', t(modalityLabelKey[task.output], locale))
    : t(modalityLabelKey[modalityOf(model)], locale)
}
