import type { RouterWorkshopModel } from '@/config/models-catalogue'
import { splitTask } from '@/config/models-catalogue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { taskLabelFor } from './task-label'

interface ModelFact {
  term: string
  value: string
  mono?: boolean
}

function knownTask(task: string | undefined) {
  const parts = task ? splitTask(task) : undefined
  return parts && parts.output !== 'other' ? task : undefined
}

export function modelDefinition(
  model: RouterWorkshopModel,
  locale: Locale = 'en'
): string {
  const { t } = translationsFor(locale)
  const task = knownTask(model.task)
  const kind = task
    ? t(
        /^[aeiou]/i.test(task)
          ? 'workshop.model.definition.kindAn'
          : 'workshop.model.definition.kindA',
        { task, label: taskLabelFor(model, locale) }
      )
    : t('workshop.model.definition.kind')
  const what = model.provider
    ? t('workshop.model.definition.whatFrom', {
        name: model.name,
        kind,
        provider: model.provider
      })
    : t('workshop.model.definition.what', { name: model.name, kind })
  const router = t('workshop.model.definition.router', {
    routerId: model.routerId
  })
  return t('workshop.model.definition.sentence', { what, router })
}

export function modelFacts(
  model: RouterWorkshopModel,
  priceEstimate: string | undefined,
  locale: Locale = 'en'
): ModelFact[] {
  const { t } = translationsFor(locale)
  const facts: ModelFact[] = [
    {
      term: t('workshop.model.facts.provider'),
      value: model.provider ?? ''
    },
    {
      term: t('workshop.model.facts.task'),
      value: knownTask(model.task) ? taskLabelFor(model, locale) : ''
    },
    {
      term: t('workshop.model.facts.routerId'),
      value: model.routerId,
      mono: true
    },
    { term: t('workshop.model.facts.price'), value: priceEstimate ?? '' }
  ]
  return facts.filter((fact) => fact.value !== '')
}
