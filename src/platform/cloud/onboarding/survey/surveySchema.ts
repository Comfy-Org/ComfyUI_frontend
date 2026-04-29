import { shuffle } from 'es-toolkit'
import { z } from 'zod'

import type {
  OnboardingSurvey,
  OnboardingSurveyField,
  OnboardingSurveyFieldCondition
} from '@/platform/remoteConfig/types'

export type SurveyValues = Record<string, string | string[] | undefined>

const hasNonEmptyValue = (current: string | string[] | undefined): boolean => {
  if (current === undefined || current === '') return false
  if (Array.isArray(current)) return current.length > 0
  return true
}

const conditionMatches = (
  condition: OnboardingSurveyFieldCondition | undefined,
  values: SurveyValues
): boolean => {
  if (!condition) return true
  const current = values[condition.field]
  if (!hasNonEmptyValue(current)) return false
  const expected = condition.equals
  if (expected === undefined) return true
  const expectedSet = Array.isArray(expected) ? expected : [expected]
  if (Array.isArray(current)) {
    return current.some((v) => expectedSet.includes(v))
  }
  return typeof current === 'string' && expectedSet.includes(current)
}

export const visibleFields = (
  survey: OnboardingSurvey,
  values: SurveyValues
): OnboardingSurveyField[] =>
  survey.fields.filter((field) => conditionMatches(field.showWhen, values))

const PIN_LAST_VALUES = new Set(['other', 'not_sure'])

const randomizeOptions = (field: OnboardingSurveyField) => {
  if (!field.randomize || !field.options) return field
  const pinned = field.options.filter((opt) => PIN_LAST_VALUES.has(opt.value))
  const rest = field.options.filter((opt) => !PIN_LAST_VALUES.has(opt.value))
  return {
    ...field,
    options: [...shuffle(rest), ...pinned]
  }
}

export const prepareSurvey = (survey: OnboardingSurvey): OnboardingSurvey => ({
  ...survey,
  fields: survey.fields.map(randomizeOptions)
})

const fieldSchema = (field: OnboardingSurveyField) => {
  if (field.type === 'multi') {
    const arr = z.array(z.string())
    return field.required
      ? arr.min(1, { message: 'Please select at least one option.' })
      : arr.optional()
  }
  if (field.required) {
    return z.string().min(1, { message: 'Please choose an option.' })
  }
  return z.string().optional()
}

export const buildZodSchema = (
  survey: OnboardingSurvey,
  values: SurveyValues
) => {
  const shape: Record<string, z.ZodTypeAny> = {}
  for (const field of survey.fields) {
    if (!conditionMatches(field.showWhen, values)) continue
    shape[field.id] = fieldSchema(field)
    if (
      field.allowOther &&
      field.otherFieldId &&
      values[field.id] === 'other'
    ) {
      shape[field.otherFieldId] = z
        .string()
        .min(1, { message: 'Please describe your answer.' })
    } else if (field.otherFieldId) {
      shape[field.otherFieldId] = z.string().optional()
    }
  }
  return z.object(shape)
}

export const buildInitialValues = (survey: OnboardingSurvey): SurveyValues => {
  const initial: SurveyValues = {}
  for (const field of survey.fields) {
    initial[field.id] = field.type === 'multi' ? [] : ''
    if (field.otherFieldId) initial[field.otherFieldId] = ''
  }
  return initial
}

export const buildSubmissionPayload = (
  survey: OnboardingSurvey,
  values: SurveyValues
): Record<string, unknown> => {
  const payload: Record<string, unknown> = {}
  for (const field of survey.fields) {
    const visible = conditionMatches(field.showWhen, values)
    if (!visible) {
      payload[field.id] = field.type === 'multi' ? [] : ''
      continue
    }
    const value = values[field.id]
    const otherRaw = field.otherFieldId ? values[field.otherFieldId] : undefined
    if (
      field.allowOther &&
      field.otherFieldId &&
      value === 'other' &&
      typeof otherRaw === 'string'
    ) {
      const other = otherRaw.trim()
      payload[field.id] = other || 'other'
    } else {
      payload[field.id] = field.type === 'multi' ? (value ?? []) : (value ?? '')
    }
  }
  return payload
}
