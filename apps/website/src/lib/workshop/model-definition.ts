import type { RouterWorkshopModel } from '@/config/models-catalogue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { nameCarriesProvider } from './model-meta-description'
import { knownTaskParts, taskLabelFor } from './task-label'

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

function taskAgreeingWithName(model: RouterWorkshopModel) {
  const parts = knownTaskParts(model)
  if (!parts) return undefined
  const task = `${parts.input}-to-${parts.output}`
  const named = taskInName(model.name)
  if (!named) return { task, inName: false }
  const inputAgrees =
    named.input === 'reference'
      ? parts.input !== 'text'
      : named.input === parts.input
  return inputAgrees && named.output === parts.output
    ? { task, inName: true }
    : undefined
}

function whatItIs(model: RouterWorkshopModel, locale: Locale) {
  const { t } = translationsFor(locale)
  const known = taskAgreeingWithName(model)
  if (!known) return undefined
  const { name, provider } = model
  const newProvider =
    provider && !nameCarriesProvider(name, provider) ? provider : undefined
  if (known.inName)
    return newProvider
      ? t('workshop.model.definition.madeBy', { name, provider: newProvider })
      : undefined
  const kind = t(
    /^[aeiou]/i.test(known.task)
      ? 'workshop.model.definition.kindAn'
      : 'workshop.model.definition.kindA',
    { task: known.task, label: taskLabelFor(model, locale) }
  )
  return newProvider
    ? t('workshop.model.definition.whatFrom', {
        name,
        kind,
        provider: newProvider
      })
    : t('workshop.model.definition.what', { name, kind })
}

export function modelDefinition(
  model: RouterWorkshopModel,
  locale: Locale = 'en'
): string {
  const { t } = translationsFor(locale)
  const router = t('workshop.model.definition.router', {
    routerId: model.routerId
  })
  const what = whatItIs(model, locale)
  return what
    ? t('workshop.model.definition.sentence', { what, router })
    : router
}

export function modelFacts(
  model: RouterWorkshopModel,
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
      value: taskAgreeingWithName(model) ? taskLabelFor(model, locale) : ''
    },
    {
      term: t('workshop.model.facts.routerId'),
      value: model.routerId,
      mono: true
    }
  ]
  return facts.filter((fact) => fact.value !== '')
}
