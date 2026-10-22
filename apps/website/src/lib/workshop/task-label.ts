import type {
  ModalityFilter,
  TaskInput,
  WorkshopModel
} from '@/config/models-catalogue'
import { modalityOf, splitTask } from '@/config/models-catalogue'
import type { Locale, TranslationKey } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

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

// The tail of the composed label is mid-sentence, so it carries its own
// wording rather than the filter chip's, which is a label of its own and
// starts with a capital.
const taskOutputKey: Record<Exclude<ModalityFilter, 'all'>, TranslationKey> = {
  image: 'workshop.task.output.image',
  video: 'workshop.task.output.video',
  audio: 'workshop.task.output.audio',
  '3d': 'workshop.task.output.3d',
  text: 'workshop.task.output.text',
  other: 'workshop.task.output.other'
}

// "Image to video" where the schema says what goes in and what comes out, and
// the plain modality where it only says what comes out.
export function taskLabelFor(model: WorkshopModel, locale: Locale): string {
  const { t } = translationsFor(locale)
  const task = model.task ? splitTask(model.task) : undefined
  return task && task.output !== 'other'
    ? t('workshop.task.label', {
        input: t(taskInputKey[task.input]),
        output: t(taskOutputKey[task.output])
      })
    : t(modalityLabelKey[modalityOf(model)])
}

/**
 * The name without the tail the card's own task pill already says. Catalogue
 * names often end in the task they perform — "Seedream 5.0 Pro Text-to-Image"
 * over a pill reading "Text to image" — and only the tail that matches that
 * pill is dropped, so a name that ends in anything else is left alone.
 */
export function nameWithoutTask(name: string, taskLabel: string): string {
  const flatten = (text: string) =>
    text
      .toLowerCase()
      .replaceAll(/[\s‐-―-]+/g, ' ')
      .trim()
  const tail = flatten(taskLabel)
  if (tail === '') return name

  const words = tail.split(' ').length
  const parts = name.split(/([\s‐-―-]+)/)
  const spoken = parts.filter((_, index) => index % 2 === 0)
  if (spoken.length <= words) return name
  if (flatten(spoken.slice(-words).join(' ')) !== tail) return name
  return parts.slice(0, (spoken.length - words) * 2 - 1).join('')
}
