import type { Locale } from '../../config/locales'

export interface SourceEntry {
  key: string
  english: string
  approved: Partial<Record<Locale, string>>
}

export interface SourceAdapter {
  readonly name: string
  read(): SourceEntry[]
}

export type EnglishSource = Record<string, string>
export type TranslationLayer = Record<string, string>
