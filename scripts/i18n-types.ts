/**
 * Shared types for i18n-related scripts
 */

export type LocaleValue = string | string[] | null | LocaleData
export type LocaleData = { [key: string]: LocaleValue }

export function isNestedLocaleData(value: LocaleValue): value is LocaleData {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
