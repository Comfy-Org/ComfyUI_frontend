import { execFileSync, spawnSync } from 'node:child_process'
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

type LocaleLeaf = boolean | number | string | null
type LocaleTrackedLeaf = LocaleLeaf | LocaleValue[]
type LocaleValue = LocaleLeaf | LocaleObject | LocaleValue[]

export interface LocaleObject {
  [key: string]: LocaleValue
}

export interface LocaleChanges {
  added: string[][]
  deleted: string[][]
  modified: string[][]
}

interface SourceManifest {
  files: Record<string, string>
  version: 1
}

interface I18nConfig {
  entry: string
  output: string
  outputLocales: string[]
}

const protectedLiteralPatterns = [
  /<(?:Picture|Video|Audio) [A-Za-z]>/g,
  /\b\d+k\+\d+\b/g,
  /(?<=['"“”「」])(?:match|max)(?=['"“”「」])/g
]
const interpolationPattern = /(?<!\\)\{[A-Za-z][A-Za-z0-9_.-]*\}/g

function isLocaleValue(value: unknown): value is LocaleValue {
  if (
    typeof value === 'boolean' ||
    typeof value === 'number' ||
    typeof value === 'string' ||
    value === null
  ) {
    return true
  }
  if (Array.isArray(value)) return value.every(isLocaleValue)
  return isLocaleObject(value)
}

function isLocaleObject(value: unknown): value is LocaleObject {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.values(value).every(isLocaleValue)
  )
}

function parseLocale(content: string, filename: string): LocaleObject {
  const parsed: unknown = JSON.parse(content)
  if (!isLocaleObject(parsed)) {
    throw new Error(`${filename} has an unsupported locale value`)
  }
  return parsed
}

function readLocale(filename: string): LocaleObject {
  return parseLocale(readFileSync(filename, 'utf8'), filename)
}

function writeLocale(filename: string, locale: LocaleObject): void {
  writeFileSync(filename, `${JSON.stringify(locale, null, 2)}\n`)
}

function pathKey(path: string[]): string {
  return JSON.stringify(path)
}

function collectLeaves(
  value: LocaleObject,
  parent: string[] = [],
  leaves = new Map<string, { path: string[]; value: LocaleTrackedLeaf }>()
): Map<string, { path: string[]; value: LocaleTrackedLeaf }> {
  for (const [key, child] of Object.entries(value)) {
    const path = [...parent, key]
    if (Array.isArray(child) || typeof child !== 'object' || child === null) {
      leaves.set(pathKey(path), { path, value: child })
    } else {
      collectLeaves(child, path, leaves)
    }
  }
  return leaves
}

function getLeaf(
  locale: LocaleObject,
  path: string[]
): LocaleTrackedLeaf | undefined {
  let value: LocaleValue | undefined = locale
  for (const segment of path) {
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      !(segment in value)
    ) {
      return undefined
    }
    value = value[segment]
  }
  return Array.isArray(value) || typeof value !== 'object' || value === null
    ? value
    : undefined
}

function deleteLeaf(locale: LocaleObject, path: string[]): void {
  const parents: Array<{ key: string; value: LocaleObject }> = []
  let value = locale

  for (const segment of path.slice(0, -1)) {
    const child = value[segment]
    if (!child || typeof child !== 'object' || Array.isArray(child)) return
    parents.push({ key: segment, value })
    value = child
  }

  delete value[path.at(-1) ?? '']
  for (const parent of parents.reverse()) {
    const child = parent.value[parent.key]
    if (child && typeof child === 'object' && Object.keys(child).length === 0) {
      delete parent.value[parent.key]
    }
  }
}

function uniqueMatches(value: string, pattern: RegExp): string[] {
  return [...new Set(value.match(pattern) ?? [])].sort()
}

function protectedTokens(
  value: string,
  includeInterpolation: boolean
): string[] {
  const tokens = protectedLiteralPatterns.flatMap((pattern) =>
    uniqueMatches(value, pattern)
  )
  if (includeInterpolation) {
    tokens.push(...uniqueMatches(value, interpolationPattern))
  }
  return [...new Set(tokens)].sort()
}

function tokenErrors(
  source: string,
  target: string,
  includeInterpolation: boolean
): string[] {
  const sourceTokens = protectedTokens(source, includeInterpolation)
  const targetTokens = protectedTokens(target, includeInterpolation)
  const missing = sourceTokens.filter((token) => !targetTokens.includes(token))
  const added = targetTokens.filter((token) => !sourceTokens.includes(token))
  return [
    ...(missing.length ? [`missing ${missing.join(', ')}`] : []),
    ...(added.length ? [`added ${added.join(', ')}`] : [])
  ]
}

function arrayTokenErrors(
  source: LocaleValue[],
  target: LocaleValue[],
  label: string
): string[] {
  if (source.length !== target.length) {
    return [`${label}: array length changed`]
  }

  const errors: string[] = []
  for (const [index, sourceValue] of source.entries()) {
    const targetValue = target[index]
    const itemLabel = `${label}.${index}`
    if (typeof sourceValue === 'string' && typeof targetValue === 'string') {
      errors.push(
        ...tokenErrors(sourceValue, targetValue, true).map(
          (error) => `${itemLabel}: ${error}`
        )
      )
    } else if (Array.isArray(sourceValue) && Array.isArray(targetValue)) {
      errors.push(...arrayTokenErrors(sourceValue, targetValue, itemLabel))
    } else if (
      sourceValue === null ||
      targetValue === null ||
      typeof sourceValue !== typeof targetValue
    ) {
      errors.push(`${itemLabel}: leaf type changed`)
    }
  }
  return errors
}

export function diffLocaleSources(
  previous: LocaleObject,
  current: LocaleObject
): LocaleChanges {
  const previousLeaves = collectLeaves(previous)
  const currentLeaves = collectLeaves(current)
  const added: string[][] = []
  const deleted: string[][] = []
  const modified: string[][] = []

  for (const [key, leaf] of currentLeaves) {
    const previousLeaf = previousLeaves.get(key)
    if (!previousLeaf) added.push(leaf.path)
    else if (
      JSON.stringify(previousLeaf.value) !== JSON.stringify(leaf.value)
    ) {
      modified.push(leaf.path)
    }
  }
  for (const [key, leaf] of previousLeaves) {
    if (!currentLeaves.has(key)) deleted.push(leaf.path)
  }

  const byPath = (left: string[], right: string[]) =>
    pathKey(left).localeCompare(pathKey(right))
  return {
    added: added.sort(byPath),
    deleted: deleted.sort(byPath),
    modified: modified.sort(byPath)
  }
}

export function prepareLocale(
  locale: LocaleObject,
  changes: LocaleChanges
): LocaleObject {
  const prepared = structuredClone(locale)
  for (const path of [
    ...changes.added,
    ...changes.modified,
    ...changes.deleted
  ]) {
    deleteLeaf(prepared, path)
  }
  return prepared
}

export function validateLocale(
  source: LocaleObject,
  locale: LocaleObject,
  changes: LocaleChanges
): string[] {
  const errors: string[] = []
  const regeneratedKeys = new Set(
    [...changes.added, ...changes.modified].map(pathKey)
  )

  for (const path of [...changes.added, ...changes.modified]) {
    const sourceValue = getLeaf(source, path)
    const targetValue = getLeaf(locale, path)
    const label = path.join('.')
    if (targetValue === undefined) {
      errors.push(`${label}: translation was not regenerated`)
      continue
    }
    if (Array.isArray(sourceValue) && Array.isArray(targetValue)) {
      errors.push(...arrayTokenErrors(sourceValue, targetValue, label))
      continue
    }
    if (typeof sourceValue !== 'string' || typeof targetValue !== 'string') {
      if (sourceValue !== targetValue)
        errors.push(`${label}: leaf type changed`)
      continue
    }
    for (const error of tokenErrors(sourceValue, targetValue, true)) {
      errors.push(`${label}: ${error}`)
    }
  }

  for (const path of changes.deleted) {
    if (getLeaf(locale, path) !== undefined) {
      errors.push(`${path.join('.')}: deleted source key remains`)
    }
  }

  for (const leaf of collectLeaves(source).values()) {
    if (typeof leaf.value !== 'string') continue
    const literalTokens = protectedTokens(leaf.value, false)
    if (literalTokens.length === 0 || regeneratedKeys.has(pathKey(leaf.path))) {
      continue
    }
    const targetValue = getLeaf(locale, leaf.path)
    if (typeof targetValue !== 'string') {
      errors.push(
        `${leaf.path.join('.')}: protected literal has no translation`
      )
      continue
    }
    for (const error of tokenErrors(leaf.value, targetValue, false)) {
      errors.push(`${leaf.path.join('.')}: ${error}`)
    }
  }

  return errors
}

function loadConfig(repoRoot: string): I18nConfig {
  const require = createRequire(import.meta.url)
  const config: unknown = require(join(repoRoot, '.i18nrc.cjs'))
  if (
    !config ||
    typeof config !== 'object' ||
    !('entry' in config) ||
    typeof config.entry !== 'string' ||
    !('output' in config) ||
    typeof config.output !== 'string' ||
    !('outputLocales' in config) ||
    !Array.isArray(config.outputLocales) ||
    !config.outputLocales.every((locale) => typeof locale === 'string')
  ) {
    throw new Error('.i18nrc.cjs has an invalid locale configuration')
  }
  return {
    entry: config.entry,
    output: config.output,
    outputLocales: config.outputLocales
  }
}

function loadManifest(filename: string): SourceManifest {
  const manifest: unknown = JSON.parse(readFileSync(filename, 'utf8'))
  if (
    !manifest ||
    typeof manifest !== 'object' ||
    !('version' in manifest) ||
    manifest.version !== 1 ||
    !('files' in manifest) ||
    !manifest.files ||
    typeof manifest.files !== 'object' ||
    Array.isArray(manifest.files) ||
    !Object.values(manifest.files).every((hash) => typeof hash === 'string')
  ) {
    throw new Error(`${filename} has an invalid source manifest`)
  }
  return manifest as SourceManifest
}

function readManifestSource(
  repoRoot: string,
  filename: string,
  hash: string
): LocaleObject {
  try {
    const content = execFileSync('git', ['cat-file', 'blob', hash], {
      cwd: repoRoot,
      encoding: 'utf8'
    })
    return parseLocale(content, `${filename}@${hash}`)
  } catch {
    throw new Error(
      `Cannot read the recorded source for ${filename} (${hash}). Fetch git history before updating locales.`
    )
  }
}

function sourceFiles(entryDir: string): string[] {
  return readdirSync(entryDir)
    .filter((filename) => filename.endsWith('.json'))
    .filter((filename) => statSync(join(entryDir, filename)).isFile())
    .sort()
}

function writeManifest(
  repoRoot: string,
  entryDir: string,
  filename: string,
  files: string[]
): void {
  const hashes = Object.fromEntries(
    files.map((sourceFile) => [
      sourceFile,
      execFileSync('git', ['hash-object', '-w', join(entryDir, sourceFile)], {
        cwd: repoRoot,
        encoding: 'utf8'
      }).trim()
    ])
  )
  writeFileSync(
    filename,
    `${JSON.stringify({ files: hashes, version: 1 }, null, 2)}\n`
  )
}

function run(): void {
  const scriptDir = dirname(fileURLToPath(import.meta.url))
  const repoRoot = resolve(scriptDir, '../..')
  const config = loadConfig(repoRoot)
  const entryDir = resolve(repoRoot, config.entry)
  const outputDir = resolve(repoRoot, config.output)
  const manifestFile = join(outputDir, '.source-manifest.json')
  const manifest = loadManifest(manifestFile)
  const files = sourceFiles(entryDir)
  const changesByFile = new Map<string, LocaleChanges>()

  for (const filename of files) {
    const current = readLocale(join(entryDir, filename))
    const hash = manifest.files[filename]
    const previous = hash
      ? readManifestSource(repoRoot, filename, hash)
      : ({} satisfies LocaleObject)
    const changes = diffLocaleSources(previous, current)
    changesByFile.set(filename, changes)

    for (const locale of config.outputLocales) {
      const outputFile = join(outputDir, locale, filename)
      const output = existsSync(outputFile) ? readLocale(outputFile) : {}
      const prepared = prepareLocale(output, changes)
      if (JSON.stringify(prepared) !== JSON.stringify(output)) {
        writeLocale(outputFile, prepared)
      }
    }
  }

  const translation = spawnSync('pnpm', ['exec', 'lobe-i18n', 'locale'], {
    cwd: repoRoot,
    env: process.env,
    stdio: 'inherit'
  })
  if (translation.error) throw translation.error
  if (translation.status !== 0) {
    throw new Error(`lobe-i18n exited with status ${translation.status}`)
  }

  const errors: string[] = []
  for (const filename of files) {
    const source = readLocale(join(entryDir, filename))
    const changes = changesByFile.get(filename)
    if (!changes) throw new Error(`Missing change plan for ${filename}`)
    for (const locale of config.outputLocales) {
      const outputFile = join(outputDir, locale, filename)
      if (!existsSync(outputFile)) {
        errors.push(`${locale}/${filename}: translation file is missing`)
        continue
      }
      errors.push(
        ...validateLocale(source, readLocale(outputFile), changes).map(
          (error) => `${locale}/${filename}: ${error}`
        )
      )
    }
  }

  if (errors.length > 0) {
    throw new Error(`Locale validation failed:\n${errors.join('\n')}`)
  }

  writeManifest(repoRoot, entryDir, manifestFile, files)
  const changedCount = [...changesByFile.values()].reduce(
    (count, changes) =>
      count +
      changes.added.length +
      changes.modified.length +
      changes.deleted.length,
    0
  )
  process.stdout.write(
    `Updated ${config.outputLocales.length} locales for ${changedCount} source changes.\n`
  )
  process.stdout.write(
    `Source provenance: ${relative(repoRoot, manifestFile)}\n`
  )
}

const invokedAsScript = process.argv[1]
  ? pathToFileURL(process.argv[1]).href === import.meta.url
  : false
if (invokedAsScript) run()
