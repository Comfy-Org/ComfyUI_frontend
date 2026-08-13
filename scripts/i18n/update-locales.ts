import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import type { OutputLocale, TranslationPipelineConfig } from './config'
import { translationPipelineConfig } from './config'
import type {
  LocaleChanges,
  LocaleLeafEntry,
  LocaleObject,
  LocaleTrackedLeaf,
  LocaleValue
} from './locale-tree'
import {
  collectLeaves,
  collectPendingLeaves,
  diffLocaleSources,
  parseLocale,
  pathKey,
  readLocale,
  rebuildLocale,
  serializeLocale
} from './locale-tree'
import {
  auditProtectedLiterals,
  leafTokensDiffer,
  protectedTokens,
  validateLocale
} from './protected-tokens'
import type { TranslateBatch, TranslationItem } from './translate'
import {
  createOpenAiTranslator,
  mapWithConcurrency,
  translateLocaleItems
} from './translate'

interface SourceManifest {
  files: Record<string, string>
  version: 1
}

interface SourcePlan {
  filename: string
  source: LocaleObject
  changes: LocaleChanges
  invalidated: Set<string>
  previousLeafCount: number
}

interface LocaleFileState {
  locale: OutputLocale
  plan: SourcePlan
  outputFile: string
  existing: LocaleObject
  pendingLeaves: LocaleLeafEntry[]
  strayPaths: string[][]
}

interface ItemRef {
  leafKey: string
  indices: number[]
}

export interface TranslationPlan {
  items: TranslationItem[]
  refs: Map<string, ItemRef>
}

export function buildTranslationItems(
  filename: string,
  pendingLeaves: readonly LocaleLeafEntry[]
): TranslationPlan {
  const items: TranslationItem[] = []
  const refs = new Map<string, ItemRef>()

  function addItem(
    leaf: LocaleLeafEntry,
    source: string,
    indices: number[]
  ): void {
    const id = String(items.length + 1)
    const indexSuffix = indices.map((index) => `[${index}]`).join('')
    items.push({
      id,
      context: `${filename}: ${leaf.path.join('.')}${indexSuffix}`,
      source,
      preserve: protectedTokens(source, true)
    })
    refs.set(id, { leafKey: pathKey(leaf.path), indices })
  }

  function addArrayItems(
    leaf: LocaleLeafEntry,
    elements: readonly LocaleValue[],
    indices: number[]
  ): void {
    for (const [index, element] of elements.entries()) {
      if (typeof element === 'string' && element.trim().length > 0) {
        addItem(leaf, element, [...indices, index])
      } else if (Array.isArray(element)) {
        addArrayItems(leaf, element, [...indices, index])
      }
    }
  }

  for (const leaf of pendingLeaves) {
    if (typeof leaf.value === 'string') {
      addItem(leaf, leaf.value, [])
    } else if (Array.isArray(leaf.value)) {
      addArrayItems(leaf, leaf.value, [])
    }
  }
  return { items, refs }
}

export function assembleLeafTranslations(
  pendingLeaves: readonly LocaleLeafEntry[],
  plan: TranslationPlan,
  translations: ReadonlyMap<string, string>
): Map<string, LocaleTrackedLeaf> {
  const assembled = new Map<string, LocaleTrackedLeaf>()
  for (const leaf of pendingLeaves) {
    assembled.set(pathKey(leaf.path), structuredClone(leaf.value))
  }

  for (const item of plan.items) {
    const ref = plan.refs.get(item.id)
    const translated = translations.get(item.id)
    if (!ref || translated === undefined) {
      throw new Error(`Missing translation for item ${item.context}`)
    }
    const leaf = assembled.get(ref.leafKey)
    if (leaf === undefined) throw new Error(`Unknown leaf for ${item.context}`)
    if (ref.indices.length === 0) {
      assembled.set(ref.leafKey, translated)
      continue
    }
    if (!Array.isArray(leaf)) {
      throw new Error(`Expected an array leaf for ${item.context}`)
    }
    let container: LocaleValue[] = leaf
    for (const index of ref.indices.slice(0, -1)) {
      const next = container[index]
      if (!Array.isArray(next)) {
        throw new Error(`Expected a nested array for ${item.context}`)
      }
      container = next
    }
    container[ref.indices.at(-1) ?? 0] = translated
  }
  return assembled
}

function loadManifest(filename: string): SourceManifest {
  if (!existsSync(filename)) {
    throw new Error(
      `${filename} is missing. The source manifest records which English sources the current translations were generated from; restore it from git history.`
    )
  }
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
    !Object.values(manifest.files).every(
      (hash) => typeof hash === 'string' && /^[0-9a-f]{40,64}$/.test(hash)
    )
  ) {
    throw new Error(`${filename} has an invalid source manifest`)
  }
  return manifest as SourceManifest
}

function readManifestSource(
  repoRoot: string,
  filename: string,
  hash: string
): LocaleObject | undefined {
  let content: string
  try {
    content = execFileSync('git', ['cat-file', 'blob', hash], {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024
    })
  } catch {
    return undefined
  }
  try {
    return parseLocale(content, `${filename}@${hash}`)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(
      `The recorded English source for ${filename} (${hash}) is not valid locale JSON: ${detail}. The source manifest may be corrupted; restore src/locales/.source-manifest.json from git history.`,
      { cause: error }
    )
  }
}

const pruneCountFloor = 25
const pruneRatioLimit = 0.02

export function exceedsPruneThreshold(
  deletedCount: number,
  previousLeafCount: number
): boolean {
  return (
    deletedCount >
    Math.max(pruneCountFloor, Math.ceil(previousLeafCount * pruneRatioLimit))
  )
}

function writeManifest(
  repoRoot: string,
  entryDir: string,
  manifestFile: string,
  filenames: readonly string[]
): void {
  const files = Object.fromEntries(
    filenames.map((filename) => [
      filename,
      execFileSync('git', ['hash-object', '-w', join(entryDir, filename)], {
        cwd: repoRoot,
        encoding: 'utf8'
      }).trim()
    ])
  )
  const serialized = `${JSON.stringify({ files, version: 1 }, null, 2)}\n`
  if (
    !existsSync(manifestFile) ||
    readFileSync(manifestFile, 'utf8') !== serialized
  ) {
    writeFileSync(manifestFile, serialized)
  }
}

function sourceFiles(entryDir: string): string[] {
  return readdirSync(entryDir)
    .filter((filename) => filename.endsWith('.json'))
    .filter((filename) => statSync(join(entryDir, filename)).isFile())
    .sort()
}

function loadLocaleFileStates(
  config: TranslationPipelineConfig,
  outputDir: string,
  plans: readonly SourcePlan[]
): LocaleFileState[] {
  return config.outputLocales.flatMap((locale) =>
    plans.map((plan) => {
      const outputFile = join(outputDir, locale.code, plan.filename)
      const existing = existsSync(outputFile) ? readLocale(outputFile) : {}
      const sourceLeafKeys = new Set(collectLeaves(plan.source).keys())
      const strayPaths = [...collectLeaves(existing).values()]
        .filter((leaf) => !sourceLeafKeys.has(pathKey(leaf.path)))
        .map((leaf) => leaf.path)
      return {
        locale,
        plan,
        outputFile,
        existing,
        pendingLeaves: collectPendingLeaves(
          plan.source,
          existing,
          plan.invalidated,
          leafTokensDiffer
        ),
        strayPaths
      }
    })
  )
}

function print(line: string): void {
  process.stdout.write(`${line}\n`)
}

function reportCheck(states: readonly LocaleFileState[]): number {
  let pendingTotal = 0
  let strayTotal = 0
  const auditErrors: string[] = []

  for (const state of states) {
    const label = `${state.locale.code}/${state.plan.filename}`
    if (state.pendingLeaves.length > 0) {
      pendingTotal += state.pendingLeaves.length
      const examples = state.pendingLeaves
        .slice(0, 5)
        .map((leaf) => leaf.path.join('.'))
        .join(', ')
      print(
        `${label}: ${state.pendingLeaves.length} strings need translation (${examples}${state.pendingLeaves.length > 5 ? ', …' : ''})`
      )
    }
    if (state.strayPaths.length > 0) {
      strayTotal += state.strayPaths.length
      print(
        `${label}: ${state.strayPaths.length} keys no longer exist in the English source and will be pruned`
      )
    }
    const pendingKeys = new Set(
      state.pendingLeaves.map((leaf) => pathKey(leaf.path))
    )
    for (const error of auditProtectedLiterals(
      state.plan.source,
      state.existing,
      pendingKeys
    )) {
      auditErrors.push(`${label}: ${error}`)
    }
  }

  for (const error of auditErrors) print(error)
  if (pendingTotal === 0 && strayTotal === 0 && auditErrors.length === 0) {
    print('All locales are up to date with the English sources.')
    return 0
  }
  print(
    `Pending: ${pendingTotal} translations, ${strayTotal} prunable keys, ${auditErrors.length} protected-token violations.`
  )
  return auditErrors.length > 0 ? 1 : 0
}

async function run(argv: readonly string[]): Promise<void> {
  const check = argv.includes('--check')
  const scriptDir = dirname(fileURLToPath(import.meta.url))
  const repoRoot = resolve(scriptDir, '../..')
  const config = translationPipelineConfig
  const entryDir = resolve(repoRoot, config.entry)
  const outputDir = resolve(repoRoot, config.output)
  const manifestFile = join(outputDir, '.source-manifest.json')
  const manifest = loadManifest(manifestFile)
  const filenames = sourceFiles(entryDir)

  const plans: SourcePlan[] = filenames.map((filename) => {
    const entryFile = join(entryDir, filename)
    const raw = readFileSync(entryFile, 'utf8')
    const source = parseLocale(raw, filename)
    // The manifest records git blob hashes of the entry files, so their bytes
    // must match what gets committed: normalize to the same serialization
    // serializeLocale produces (collect-i18n omits the newline oxfmt adds)
    const canonical = serializeLocale(source)
    if (!check && raw !== canonical) writeFileSync(entryFile, canonical)
    const hash = manifest.files[filename]
    const recorded = hash ? readManifestSource(repoRoot, filename, hash) : {}
    if (recorded === undefined && !check) {
      throw new Error(
        `Cannot read the recorded English source for ${filename} (${hash}). Run from a clone with full history (a blobless partial clone works: fetch-depth: 0 with filter: blob:none, which lazily fetches the blob over the network).`
      )
    }
    if (recorded === undefined) {
      print(
        `WARNING: ${filename}: the recorded English source (${hash}) is unavailable in this clone; changed-string detection is skipped for this check.`
      )
    }
    const previous = recorded ?? source
    const changes = diffLocaleSources(previous, source)
    return {
      filename,
      source,
      changes,
      invalidated: new Set(
        [...changes.added, ...changes.modified].map(pathKey)
      ),
      previousLeafCount: collectLeaves(previous).size
    }
  })

  const oversizedPrunes = plans
    .filter((plan) =>
      exceedsPruneThreshold(plan.changes.deleted.length, plan.previousLeafCount)
    )
    .map(
      (plan) =>
        `${plan.filename}: ${plan.changes.deleted.length} of ${plan.previousLeafCount} keys would be deleted`
    )
  if (oversizedPrunes.length > 0) {
    if (check) {
      for (const line of oversizedPrunes) {
        print(`WARNING: large prune pending — ${line}`)
      }
    } else if (!argv.includes('--allow-prune')) {
      throw new Error(
        `Refusing to prune:\n${oversizedPrunes.join('\n')}\nA shrink this large usually means collect-i18n observed a partial app (failed custom-node imports or an incomplete server node list). Verify the English sources are complete, or rerun with --allow-prune to confirm the deletions.`
      )
    }
  }

  const states = loadLocaleFileStates(config, outputDir, plans)

  if (check) {
    process.exitCode = reportCheck(states)
    return
  }

  const translationPlans = new Map(
    states.map((state) => [
      state,
      buildTranslationItems(state.plan.filename, state.pendingLeaves)
    ])
  )
  const pendingTotal = [...translationPlans.values()].reduce(
    (count, plan) => count + plan.items.length,
    0
  )

  const apiKey = process.env.OPENAI_API_KEY
  if (pendingTotal > 0 && !apiKey) {
    throw new Error(
      `${pendingTotal} strings need translation but OPENAI_API_KEY is not set.`
    )
  }
  const translateBatch: TranslateBatch = apiKey
    ? createOpenAiTranslator({
        apiKey,
        model: config.model,
        reasoningEffort: config.reasoningEffort,
        glossary: config.glossary
      })
    : async () => {
        throw new Error('No translator available')
      }

  const outcomes = await mapWithConcurrency(
    states,
    config.localeConcurrency,
    async (
      state
    ): Promise<
      | { state: LocaleFileState; output: LocaleObject }
      | { state: LocaleFileState; failure: string }
    > => {
      try {
        const plan = translationPlans.get(state)
        if (!plan) throw new Error('Missing translation plan')
        const translations =
          plan.items.length > 0
            ? await translateLocaleItems(
                state.locale,
                plan.items,
                translateBatch,
                config
              )
            : new Map<string, string>()
        const leafTranslations = assembleLeafTranslations(
          state.pendingLeaves,
          plan,
          translations
        )
        const output = rebuildLocale(
          state.plan.source,
          state.existing,
          state.plan.invalidated,
          leafTranslations
        )
        return { state, output }
      } catch (error) {
        return {
          state,
          failure: error instanceof Error ? error.message : String(error)
        }
      }
    }
  )

  const failures = outcomes.flatMap((outcome) =>
    'failure' in outcome
      ? [
          `${outcome.state.locale.code}/${outcome.state.plan.filename}: ${outcome.failure}`
        ]
      : []
  )
  if (failures.length > 0) {
    throw new Error(
      `Translation failed for ${failures.length} locale files:\n${failures.join('\n')}`
    )
  }
  const rebuilt = outcomes.flatMap((outcome) =>
    'output' in outcome ? [outcome] : []
  )

  const errors = rebuilt.flatMap(({ state, output }) =>
    validateLocale(state.plan.source, output, state.plan.changes).map(
      (error) => `${state.locale.code}/${state.plan.filename}: ${error}`
    )
  )
  if (errors.length > 0) {
    throw new Error(`Locale validation failed:\n${errors.join('\n')}`)
  }

  let written = 0
  for (const { state, output } of rebuilt) {
    const serialized = serializeLocale(output)
    const current = existsSync(state.outputFile)
      ? readFileSync(state.outputFile, 'utf8')
      : undefined
    if (serialized !== current) {
      mkdirSync(dirname(state.outputFile), { recursive: true })
      writeFileSync(state.outputFile, serialized)
      written++
    }
  }
  writeManifest(repoRoot, entryDir, manifestFile, filenames)

  print(
    `Translated ${pendingTotal} strings; updated ${written} locale files across ${config.outputLocales.length} locales.`
  )
  print(`Source provenance: ${relative(repoRoot, manifestFile)}`)
}

const invokedAsScript = process.argv[1]
  ? pathToFileURL(process.argv[1]).href === import.meta.url
  : false
if (invokedAsScript) {
  run(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
