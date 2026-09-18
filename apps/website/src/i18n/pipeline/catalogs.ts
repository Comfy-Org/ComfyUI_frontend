import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { translationTargets } from '@comfyorg/comfyui-frontend/scripts/i18n/config'
import {
  collectLeaves,
  diffLocaleSources,
  getLeaf,
  pathKey,
  readLocale
} from '@comfyorg/comfyui-frontend/scripts/i18n/locale-tree'
import {
  machineTranslationsSchema,
  translationDigest
} from '@comfyorg/comfyui-frontend/scripts/i18n/translation-ownership'
import {
  loadManifest,
  readManifestSource
} from '@comfyorg/comfyui-frontend/scripts/i18n/update-locales'
import type { Locale } from '../../config/locales'
import type { SourceEntry, TranslationLayer } from './types'

const repoRoot = fileURLToPath(new URL('../../../../../', import.meta.url))
const catalogDir = fileURLToPath(new URL('../../locales/', import.meta.url))

export function catalogEntries(filename: string): SourceEntry[] {
  const source = readLocale(`${catalogDir}en/${filename}`)
  const ownership = machineTranslationsSchema.parse(
    JSON.parse(readFileSync(`${catalogDir}.machine-translations.json`, 'utf8'))
  )
  const targets = translationTargets.website.outputLocales.map(({ code }) => ({
    locale: code as Locale,
    tree: existsSync(`${catalogDir}${code}/${filename}`)
      ? readLocale(`${catalogDir}${code}/${filename}`)
      : {},
    owned: ownership.files[`${code}/${filename}`] ?? {}
  }))
  return [...collectLeaves(source).values()].flatMap((leaf): SourceEntry[] => {
    if (typeof leaf.value !== 'string') return []
    const approved: Partial<Record<Locale, string>> = {}
    for (const { locale, tree, owned } of targets) {
      const value = getLeaf(tree, leaf.path)
      if (
        typeof value === 'string' &&
        owned[pathKey(leaf.path)] !== translationDigest(value)
      )
        approved[locale] = value
    }
    return [{ key: leaf.path.join('.'), english: leaf.value, approved }]
  })
}

export function machineLayer(
  filename: string,
  locale: Locale
): TranslationLayer {
  const file = `${catalogDir}${locale}/${filename}`
  if (locale === 'en' || !existsSync(file)) return {}
  const source = readLocale(`${catalogDir}en/${filename}`)
  const target = readLocale(file)
  const ownership = machineTranslationsSchema.parse(
    JSON.parse(readFileSync(`${catalogDir}.machine-translations.json`, 'utf8'))
  )
  const owned = ownership.files[`${locale}/${filename}`] ?? {}
  const manifest = loadManifest(`${catalogDir}.source-manifest.json`)
  const hash = manifest.files[filename]
  const previous = hash ? readManifestSource(repoRoot, filename, hash) : {}
  if (!previous)
    throw new Error(
      `Cannot read source history for ${filename}; fetch full history before projecting translations.`
    )
  const changes = diffLocaleSources(previous, source)
  const invalid = new Set([...changes.added, ...changes.modified].map(pathKey))
  return Object.fromEntries(
    [...collectLeaves(source)].flatMap(([key, leaf]) => {
      const value = getLeaf(target, leaf.path)
      const name = leaf.path.join('.')
      const excluded = translationTargets.website.excludedKeyPrefixes?.some(
        (prefix) => name === prefix || name.startsWith(`${prefix}.`)
      )
      return typeof value === 'string' &&
        !invalid.has(key) &&
        !excluded &&
        owned[key] === translationDigest(value)
        ? [[name, value]]
        : []
    })
  )
}
