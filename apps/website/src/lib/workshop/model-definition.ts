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

const NAMED_OUTPUT: Record<string, string> = {
  speech: 'audio',
  dialogue: 'audio',
  vector: 'image'
}

function taskInName(name: string) {
  const edit = /\b(image|video) edit\b/i.exec(name)?.[1].toLowerCase()
  if (edit) return { input: edit, output: edit }
  const [, input, output] =
    /\b(text|image|video|audio|reference)-to-(\w+)/i.exec(name) ?? []
  if (!input || !output) return undefined
  const named = output.toLowerCase()
  return { input: input.toLowerCase(), output: NAMED_OUTPUT[named] ?? named }
}

function knownTask({ name, task }: RouterWorkshopModel) {
  const parts = task ? splitTask(task) : undefined
  if (!parts || parts.output === 'other') return undefined
  const named = taskInName(name)
  if (!named) return task
  const inputAgrees =
    named.input === 'reference'
      ? parts.input !== 'text'
      : named.input === parts.input
  return inputAgrees && named.output === parts.output ? task : undefined
}

export function modelDefinition(
  model: RouterWorkshopModel,
  locale: Locale = 'en'
): string {
  const { t } = translationsFor(locale)
  const task = knownTask(model)
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
      value: knownTask(model) ? taskLabelFor(model, locale) : ''
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
