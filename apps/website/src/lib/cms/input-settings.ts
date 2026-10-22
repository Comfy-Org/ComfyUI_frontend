import type { Document } from '@/lib/cms/editor-document'
import { documentField } from '@/lib/cms/editor-document'
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
type SettingsError =
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
    return numericSettings.every((key) => validNumericSetting(property, key))
      ? 'numeric'
      : 'unsupported'
  }
  return optionsMode(property, presentation)
}
function validNumericSetting(property: Document, key: NumericSetting) {
  const value = documentField(property, key)
  return value === undefined || (typeof value === 'number' && scalar(value))
}
function optionsMode(property: Document, presentation: Document) {
  if (
    presentation.control !== 'dropdown' ||
    !labelMap(presentation.optionLabels)
  )
    return 'unsupported'
  const defaultValue = documentField(property, 'default')
  if (defaultValue !== undefined && !scalar(defaultValue)) return 'unsupported'
  const enumValue = documentField(property, 'enum')
  if (!validEnum(enumValue)) return 'unsupported'
  const values = Array.isArray(property.enum) ? property.enum : []
  if (new Set(values.map(String)).size !== values.length) return 'unsupported'
  return 'options'
}
function validEnum(value: Document[string] | undefined) {
  return value === undefined || (Array.isArray(value) && value.every(scalar))
}
function numericText(property: Document, key: NumericSetting): string {
  const value = documentField(property, key)
  return value === undefined ? '' : String(value)
}
function jsonText(value: Document[string] | undefined): string {
  return value === undefined ? '' : JSON.stringify(value)
}
export function settingsBuffer(value: InputSettingsValue): SettingsBuffer {
  const labels = labelMap(value.presentation.optionLabels) ?? {}
  return {
    numeric: {
      minimum: numericText(value.property, 'minimum'),
      maximum: numericText(value.property, 'maximum'),
      default: numericText(value.property, 'default'),
      multipleOf: numericText(value.property, 'multipleOf')
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
    defaultJSON: jsonText(documentField(value.property, 'default'))
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
function buildNumericProperty(
  property: Document,
  buffer: SettingsBuffer
): SettingsError | undefined {
  for (const key of numericSettings) {
    const text = buffer.numeric[key]
    if (text === '') {
      delete property[key]
      continue
    }
    const value = parseSettingsNumber(text)
    if (value === undefined) return 'number'
    property[key] = value
  }
  return numericPropertyError(property)
}
function numericPropertyError(property: Document): SettingsError | undefined {
  if (
    typeof property.minimum === 'number' &&
    typeof property.maximum === 'number' &&
    property.minimum > property.maximum
  )
    return 'bounds'
  if (typeof property.multipleOf === 'number' && property.multipleOf <= 0)
    return 'step'
  const defaultValue = documentField(property, 'default')
  if (
    defaultValue !== undefined &&
    !validateWorkshopInput(defaultValue, property)
  )
    return 'default'
  return undefined
}
function setOptionDefault(
  property: Document,
  json: string
): SettingsError | undefined {
  if (json === '') {
    delete property.default
    return undefined
  }
  let value: unknown
  try {
    value = JSON.parse(json)
  } catch {
    return 'default'
  }
  if (!scalar(value) || !validateWorkshopInput(value, property))
    return 'default'
  property.default = value
  return undefined
}
function buildOptionProperty(
  property: Document,
  buffer: SettingsBuffer
): SettingsError | undefined {
  if (!buffer.options.length) return 'options'
  const values: OptionValue[] = []
  for (const row of buffer.options) {
    const value = optionValue(row)
    if (value === undefined) return 'number'
    values.push(value)
  }
  if (
    new Set(values.map((value) => JSON.stringify(value))).size !== values.length
  )
    return 'duplicate'
  if (new Set(values.map(String)).size !== values.length)
    return 'labelCollision'
  property.enum = values
  if (values.some((value) => !validateWorkshopInput(value, property)))
    return 'optionSchema'
  return setOptionDefault(property, buffer.defaultJSON)
}
function updateOptionLabels(
  base: InputSettingsValue,
  buffer: SettingsBuffer,
  presentation: Document
) {
  const labels = new Map(
    Object.entries(labelMap(presentation.optionLabels) ?? {})
  )
  if (Array.isArray(base.property.enum))
    for (const value of base.property.enum)
      if (scalar(value)) labels.delete(String(value))
  for (const row of buffer.options) {
    const key = String(optionValue(row))
    if (row.label !== '') labels.set(key, row.label)
    else labels.delete(key)
  }
  if (labels.size || Object.hasOwn(base.presentation, 'optionLabels'))
    presentation.optionLabels = Object.fromEntries(labels)
  else delete presentation.optionLabels
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
  const error =
    mode === 'numeric'
      ? buildNumericProperty(property, buffer)
      : buildOptionProperty(property, buffer)
  if (error) return { valid: false, error }
  if (mode === 'options') updateOptionLabels(base, buffer, presentation)
  return { valid: true, value: { property, presentation } }
}
