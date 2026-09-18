import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import {
  collectLeaves,
  pathKey,
  readLocale,
  serializeLocale
} from '@comfyorg/comfyui-frontend/scripts/i18n/locale-tree'
import type {
  LocaleObject,
  LocaleTrackedLeaf
} from '@comfyorg/comfyui-frontend/scripts/i18n/locale-tree'
import {
  machineTranslationsSchema,
  projectLocale
} from '@comfyorg/comfyui-frontend/scripts/i18n/translation-ownership'
import { LOCALIZED_CODES } from '../../src/config/locales'
import {
  catalogEntries,
  machineLayer,
  translatedLayer
} from '../../src/i18n/pipeline/catalogs'
import { translatableEntries } from '../../src/i18n/pipeline/source'
import type { SourceAdapter } from '../../src/i18n/pipeline/types'
import { dataAdapter } from '../../src/i18n/pipeline/adapters/data'
import { faqAdapter } from '../../src/i18n/pipeline/adapters/faq'
import { writeSortedJson } from './write-json'

const ADAPTERS: SourceAdapter[] = [faqAdapter, dataAdapter]
const catalogDir = path.resolve('src/locales')
const ownershipFile = `${catalogDir}/.machine-translations.json`
const ownership = machineTranslationsSchema.parse(
  JSON.parse(readFileSync(ownershipFile, 'utf8'))
)
const entries = ADAPTERS.flatMap((adapter) => adapter.read())
const source: LocaleObject = {}
for (const entry of entries) {
  const segments = entry.key.split('.')
  let parent = source
  for (const segment of segments.slice(0, -1)) {
    const value = parent[segment]
    if (typeof value === 'string')
      throw new Error(`Conflicting content key ${entry.key}`)
    if (!value || typeof value !== 'object' || Array.isArray(value))
      parent[segment] = {}
    const next = parent[segment]
    if (!next || typeof next !== 'object' || Array.isArray(next))
      throw new Error(`Invalid content key ${entry.key}`)
    parent = next
  }
  const key = segments.at(-1)
  if (!key || Object.hasOwn(parent, key))
    throw new Error(`Duplicate content key ${entry.key}`)
  parent[key] = entry.english
}
mkdirSync(`${catalogDir}/en`, { recursive: true })
writeFileSync(`${catalogDir}/en/content.json`, serializeLocale(source))
for (const locale of LOCALIZED_CODES) {
  const file = `${catalogDir}/${locale}/content.json`
  const existing = existsSync(file) ? readLocale(file) : {}
  const values = new Map<string, LocaleTrackedLeaf>(
    [...collectLeaves(existing)].map(([key, leaf]) => [key, leaf.value])
  )
  for (const entry of entries) {
    const value = entry.approved[locale]
    if (value !== undefined) values.set(pathKey(entry.key.split('.')), value)
  }
  const approvedKeys = new Set(
    entries
      .filter((entry) => entry.approved[locale] !== undefined)
      .map((entry) => pathKey(entry.key.split('.')))
  )
  ownership.files[`${locale}/content.json`] = Object.fromEntries(
    Object.entries(ownership.files[`${locale}/content.json`] ?? {}).filter(
      ([key]) => !approvedKeys.has(key)
    )
  )
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, serializeLocale(projectLocale(source, values)))
}
writeFileSync(ownershipFile, `${JSON.stringify(ownership, null, 2)}\n`)
const english = Object.fromEntries(
  translatableEntries([...catalogEntries('main.json'), ...entries]).map(
    ({ key, english }) => [key, english]
  )
)
writeSortedJson(path.resolve('src/i18n/content/en.json'), english)
for (const locale of LOCALIZED_CODES) {
  writeSortedJson(path.resolve(`src/i18n/content/${locale}.json`), {
    ...machineLayer('main.json', locale),
    ...translatedLayer('content.json', locale)
  })
}
