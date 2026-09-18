import { readFileSync } from 'node:fs'

export function parsePreserveTerms(text: string, file: string): string[] {
  const value: unknown = JSON.parse(text)
  if (
    !Array.isArray(value) ||
    !value.every((term): term is string => typeof term === 'string')
  )
    throw new Error(`${file} must be an array of strings`)
  return value
}

export function preserveTerms(): string[] {
  const file = new URL(
    '../../src/i18n/glossary/preserve-terms.json',
    import.meta.url
  )
  return parsePreserveTerms(readFileSync(file, 'utf8'), file.pathname)
}
