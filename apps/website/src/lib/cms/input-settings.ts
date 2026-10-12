import type { Document } from '@/lib/cms/editor-document'
import { validateWorkshopInput } from '@/config/workshop-json-schema'

export type OptionValue = string | number | boolean
export interface InputSettingsValue {
  property: Document
  presentation: Document
}
function copyJSON(value: Document[string]): Document[string] {
  if (Array.isArray(value)) return value.map(copyJSON)
  if (value !== null && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, copyJSON(child)])
    )
  return value
}
export function copySettings(value: InputSettingsValue): InputSettingsValue {
  // Object.fromEntries preserves literal keys (including special string enum
  // labels), never invokes __proto__ setters, and unwraps nested Vue proxies.
  const record = (document: Document): Document =>
    Object.fromEntries(
      Object.entries(document).map(([key, child]) => [key, copyJSON(child)])
    )
  return {
    property: record(value.property),
    presentation: record(value.presentation)
  }
}
export const numericSettings = [
  'minimum',
  'maximum',
  'default',
  'multipleOf'
] as const
export type NumericSetting = (typeof numericSettings)[number]
export interface OptionBuffer {
  key: string
  type: 'string' | 'number' | 'boolean'
  text: string
  label: string
}
export interface SettingsBuffer {
  numeric: Record<NumericSetting, string>
  options: OptionBuffer[]
  defaultJSON: string
}
export type SettingsError =
  | 'number'
  | 'bounds'
  | 'step'
  | 'default'
  | 'options'
  | 'optionSchema'
  | 'duplicate'
  | 'labelCollision'
export type SettingsResult =
  | { valid: true; value: InputSettingsValue }
  | { valid: false; error: SettingsError }

function scalar(value: unknown): value is OptionValue {
  return (
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' &&
      Number.isFinite(value) &&
      (!Number.isInteger(value) || Number.isSafeInteger(value)))
  )
}
function labelMap(
  value: Document[string] | undefined
): Record<string, string> | undefined {
  if (value === undefined) return {}
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    return
  const entries = Object.entries(value)
  if (
    entries.some(([, label]) => typeof label !== 'string' || label.length === 0)
  )
    return
  return Object.fromEntries(
    entries.filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string'
    )
  )
}
export function settingsMode({
  property,
  presentation
}: InputSettingsValue): 'numeric' | 'options' | 'unsupported' {
  if (
    [
      '$ref',
      'allOf',
      'oneOf',
      'anyOf',
      'not',
      'if',
      'then',
      'else',
      'const'
    ].some((key) => Object.hasOwn(property, key))
  )
    return 'unsupported'
  if (
    (presentation.control === 'number' || presentation.control === 'slider') &&
    (property.type === 'number' || property.type === 'integer') &&
    !Object.hasOwn(property, 'enum')
  ) {
    return numericSettings.every((key) => {
      const value = property[key]
      return (
        value === undefined ||
        (typeof value === 'number' &&
          Number.isFinite(value) &&
          (!Number.isInteger(value) || Number.isSafeInteger(value)))
      )
    })
      ? 'numeric'
      : 'unsupported'
  }
  if (
    presentation.control !== 'dropdown' ||
    !labelMap(presentation.optionLabels)
  )
    return 'unsupported'
  if (property.default !== undefined && !scalar(property.default))
    return 'unsupported'
  if (
    property.enum !== undefined &&
    (!Array.isArray(property.enum) || !property.enum.every(scalar))
  )
    return 'unsupported'
  const values = Array.isArray(property.enum) ? property.enum : []
  // Existing presentation labels use String(value). Mixed values which collide
  // in that mapping cannot safely be represented as independently labeled rows.
  if (new Set(values.map(String)).size !== values.length) return 'unsupported'
  return 'options'
}
export function settingsBuffer(value: InputSettingsValue): SettingsBuffer {
  const labels = labelMap(value.presentation.optionLabels) ?? {}
  return {
    numeric: {
      minimum:
        value.property.minimum === undefined
          ? ''
          : String(value.property.minimum),
      maximum:
        value.property.maximum === undefined
          ? ''
          : String(value.property.maximum),
      default:
        value.property.default === undefined
          ? ''
          : String(value.property.default),
      multipleOf:
        value.property.multipleOf === undefined
          ? ''
          : String(value.property.multipleOf)
    },
    options: Array.isArray(value.property.enum)
      ? value.property.enum.filter(scalar).map((option) => ({
          key: crypto.randomUUID(),
          type:
            typeof option === 'number'
              ? 'number'
              : typeof option === 'boolean'
                ? 'boolean'
                : 'string',
          text: String(option),
          label: Object.hasOwn(labels, String(option))
            ? labels[String(option)]
            : ''
        }))
      : [],
    defaultJSON:
      value.property.default === undefined
        ? ''
        : JSON.stringify(value.property.default)
  }
}
export function parseSettingsNumber(text: string): number | undefined {
  if (!/^-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)) return
  const number = Number(text)
  if (
    !Number.isFinite(number) ||
    (Number.isInteger(number) && !Number.isSafeInteger(number))
  )
    return
  return number
}
export function optionValue(row: OptionBuffer): OptionValue | undefined {
  if (row.type === 'string') return row.text
  if (row.type === 'number') return parseSettingsNumber(row.text)
  if (row.text === 'true') return true
  if (row.text === 'false') return false
  return undefined
}
export function buildSettings(
  base: InputSettingsValue,
  buffer: SettingsBuffer
): SettingsResult {
  const mode = settingsMode(base)
  const property = { ...base.property }
  const presentation = { ...base.presentation }
  if (mode === 'unsupported')
    return { valid: true, value: { property, presentation } }
  if (mode === 'numeric') {
    for (const key of numericSettings) {
      const text = buffer.numeric[key]
      if (text === '') {
        delete property[key]
        continue
      }
      const value = parseSettingsNumber(text)
      if (value === undefined) return { valid: false, error: 'number' }
      property[key] = value
    }
    if (
      typeof property.minimum === 'number' &&
      typeof property.maximum === 'number' &&
      property.minimum > property.maximum
    )
      return { valid: false, error: 'bounds' }
    if (typeof property.multipleOf === 'number' && property.multipleOf <= 0)
      return { valid: false, error: 'step' }
    if (
      property.default !== undefined &&
      !validateWorkshopInput(property.default, property)
    )
      return { valid: false, error: 'default' }
  } else {
    if (!buffer.options.length) return { valid: false, error: 'options' }
    const values: OptionValue[] = []
    for (const row of buffer.options) {
      const value = optionValue(row)
      if (value === undefined) return { valid: false, error: 'number' }
      values.push(value)
    }
    if (
      new Set(values.map((value) => JSON.stringify(value))).size !==
      values.length
    )
      return { valid: false, error: 'duplicate' }
    if (new Set(values.map(String)).size !== values.length)
      return { valid: false, error: 'labelCollision' }
    property.enum = values
    if (values.some((value) => !validateWorkshopInput(value, property)))
      return { valid: false, error: 'optionSchema' }
    if (buffer.defaultJSON === '') delete property.default
    else {
      let value: unknown
      try {
        value = JSON.parse(buffer.defaultJSON)
      } catch {
        return { valid: false, error: 'default' }
      }
      if (!scalar(value) || !validateWorkshopInput(value, property))
        return { valid: false, error: 'default' }
      property.default = value
    }
    const labels = new Map(
      Object.entries(labelMap(presentation.optionLabels) ?? {})
    )
    // Delete only labels belonging to options we explicitly edit. Preserve
    // unrelated metadata/labels rather than treating this as a JSON sanitizer.
    if (Array.isArray(base.property.enum))
      for (const value of base.property.enum)
        if (scalar(value)) labels.delete(String(value))
    buffer.options.forEach((row, index) => {
      const key = String(values[index])
      if (row.label !== '') labels.set(key, row.label)
      else labels.delete(key)
    })
    if (labels.size || Object.hasOwn(base.presentation, 'optionLabels'))
      presentation.optionLabels = Object.fromEntries(labels)
    else delete presentation.optionLabels
  }
  return { valid: true, value: { property, presentation } }
}
