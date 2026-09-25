import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { ResponseUsage } from 'openai/resources/responses/responses'

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
  chunkItems,
  createOpenAiTranslator,
  createRequestCounter,
  mapWithConcurrency,
  translateLocaleItems
} from './translate'
import { isMainModule } from '../isMainModule'

interface SourceManifest {
  files: Record<string, string>
  // Transitional baseline: leaf path keys per entry file whose committed
  // translations violated token validation when the manifest was recorded.
  // The check exempts them; a successful locale run heals and drops them.
  knownViolations?: Record<string, string[]>
  // Transitional baselines: leaf path keys that were already drifting when the
  // manifest was recorded, keyed by `<locale>/<entry file>`. The check exempts
  // them so pre-existing lag does not fail every unrelated PR; any key outside
  // them fails. Scoped per locale, because a key can be pending in one locale
  // and translated in another, and a filename-only baseline would let a new gap
  // in one locale hide behind another locale's recorded lag. A successful
  // locale run heals and drops the entries for that entry file.
  //
  // Pending and stray are kept apart deliberately. A single shared list would
  // exempt a key in both directions. A key baselined as stray can later become
  // pending for a locale after it is restored in `en`; that new drift must not
  // inherit the stale exemption.
  /** Keys with no usable translation yet (missing, blanked or invalidated). */
  knownPending?: Record<string, string[]>
  /** Keys the locale still carries that `en` no longer has. */
  knownStray?: Record<string, string[]>
  version: 1
}

interface SourcePlan {
  filename: string
  source: LocaleObject
  changes: LocaleChanges
  invalidated: Set<string>
  previousLeafCount: number
  degraded: boolean
  knownViolationKeys: ReadonlySet<string>
}

export interface LocaleFileState {
  locale: OutputLocale
  plan: SourcePlan
  outputFile: string
  existing: LocaleObject
  pendingLeaves: LocaleLeafEntry[]
  strayPaths: string[][]
  /** Pending baseline for THIS locale and entry file. */
  knownPendingKeys: ReadonlySet<string>
  /** Stray baseline for THIS locale and entry file. */
  knownStrayKeys: ReadonlySet<string>
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

/**
 * A manifest baseline field is optional, but when present must be a plain
 * object mapping an entry filename to an array of leaf path keys.
 */
function isValidBaselineField(manifest: object, field: string): boolean {
  if (!(field in manifest)) return true
  const value = (manifest as Record<string, unknown>)[field]
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.values(value).every(
      (keys) =>
        Array.isArray(keys) && keys.every((key) => typeof key === 'string')
    )
  )
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
    ) ||
    !isValidBaselineField(manifest, 'knownViolations') ||
    !isValidBaselineField(manifest, 'knownPending') ||
    !isValidBaselineField(manifest, 'knownStray')
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

export function formatPruneSummary(
  filename: string,
  deletedCount: number,
  previousLeafCount: number
): string | undefined {
  if (deletedCount === 0) return
  return `WARNING: ${filename}: ${deletedCount} of ${previousLeafCount} English keys deleted; matching locale keys will be pruned.`
}

/**
 * Carry a transitional manifest baseline forward for entry files whose locale
 * run did not complete. A completed file has been fully revalidated, so its
 * baseline is healed and dropped; that drain is what keeps a baseline
 * transitional instead of a permanent exemption.
 */
export function preservedBaseline(
  filenames: readonly string[],
  completedFilenames: ReadonlySet<string>,
  baseline: Readonly<Record<string, string[]>> | undefined
): Record<string, string[]> {
  return Object.fromEntries(
    filenames.flatMap((filename) => {
      if (completedFilenames.has(filename)) return []
      const keys = baseline?.[filename]
      return keys && keys.length > 0 ? [[filename, keys] as const] : []
    })
  )
}

/**
 * Carry the per-locale pending baseline forward. Keys are `<locale>/<entry
 * file>`, so completion is matched on the entry-file half: a completed file has
 * every pending key translated and every stray key pruned in every locale.
 */
export function preservedPendingBaseline(
  completedFilenames: ReadonlySet<string>,
  baseline: Readonly<Record<string, string[]>> | undefined
): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(baseline ?? {}).filter(([key, keys]) => {
      const filename = key.slice(key.indexOf('/') + 1)
      return keys.length > 0 && !completedFilenames.has(filename)
    })
  )
}

function writeManifest(
  repoRoot: string,
  entryDir: string,
  manifestFile: string,
  advancedFilenames: readonly string[],
  preservedFiles: Readonly<Record<string, string>>,
  preservedViolations: Readonly<Record<string, string[]>>,
  preservedPending: Readonly<Record<string, string[]>>,
  preservedStray: Readonly<Record<string, string[]>>
): void {
  const files = Object.fromEntries(
    [
      ...Object.entries(preservedFiles),
      ...advancedFilenames.map((filename) => [
        filename,
        execFileSync('git', ['hash-object', '-w', join(entryDir, filename)], {
          cwd: repoRoot,
          encoding: 'utf8'
        }).trim()
      ])
    ].sort(([left], [right]) => left.localeCompare(right))
  )
  const manifest: SourceManifest = {
    files,
    ...(Object.keys(preservedViolations).length > 0
      ? { knownViolations: preservedViolations }
      : {}),
    ...(Object.keys(preservedPending).length > 0
      ? { knownPending: preservedPending }
      : {}),
    ...(Object.keys(preservedStray).length > 0
      ? { knownStray: preservedStray }
      : {}),
    version: 1
  }
  const serialized = `${JSON.stringify(manifest, null, 2)}\n`
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

function orphanedOutputFiles(
  outputDir: string,
  config: TranslationPipelineConfig,
  entryFilenames: readonly string[]
): string[] {
  const entrySet = new Set(entryFilenames)
  return config.outputLocales.flatMap((locale) => {
    const localeDir = join(outputDir, locale.code)
    if (!existsSync(localeDir)) return []
    return readdirSync(localeDir)
      .filter((filename) => filename.endsWith('.json'))
      .filter((filename) => !entrySet.has(filename))
      .map((filename) => join(localeDir, filename))
  })
}

/**
 * Key for a per-locale manifest baseline entry. Matches the `<locale>/<entry
 * file>` label the check already prints, so a manifest row reads the same way
 * as the output line it exempts.
 */
export function pendingBaselineKey(
  localeCode: string,
  filename: string
): string {
  return `${localeCode}/${filename}`
}

function loadLocaleFileStates(
  config: TranslationPipelineConfig,
  outputDir: string,
  plans: readonly SourcePlan[],
  knownPending: Readonly<Record<string, string[]>> | undefined,
  knownStray: Readonly<Record<string, string[]>> | undefined
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
        strayPaths,
        knownPendingKeys: new Set(
          knownPending?.[pendingBaselineKey(locale.code, plan.filename)] ?? []
        ),
        knownStrayKeys: new Set(
          knownStray?.[pendingBaselineKey(locale.code, plan.filename)] ?? []
        )
      }
    })
  )
}

function print(line: string): void {
  process.stdout.write(`${line}\n`)
}

export function formatUsageSummary(
  usages: ReadonlyArray<Partial<ResponseUsage> | undefined>,
  requestCount: number
): string {
  let inputTokens = 0
  let outputTokens = 0
  let reasoningTokens = 0
  let totalTokens = 0
  for (const usage of usages) {
    if (!usage) continue
    inputTokens += usage.input_tokens ?? 0
    outputTokens += usage.output_tokens ?? 0
    reasoningTokens += usage.output_tokens_details?.reasoning_tokens ?? 0
    totalTokens += usage.total_tokens ?? 0
  }
  return `OpenAI usage: ${requestCount} HTTP requests for ${usages.length} responses; ${inputTokens} input, ${outputTokens} output (${reasoningTokens} reasoning), ${totalTokens} total tokens.`
}

/**
 * Leaf paths that drifted from the English source without being recorded in
 * the manifest baseline, as at most one reviewer-facing line naming them.
 */
function unbaselinedDrift(
  label: string,
  paths: readonly string[][],
  baseline: ReadonlySet<string>,
  what: string
): string[] {
  const unbaselined = paths.filter((path) => !baseline.has(pathKey(path)))
  if (unbaselined.length === 0) return []
  return [
    `${label}: ${unbaselined.length} keys ${what} and are not in the manifest baseline: ${unbaselined.map((path) => path.join('.')).join(', ')}`
  ]
}

interface LocaleCheckFindings {
  pending: number
  stray: number
  auditErrors: string[]
  driftErrors: string[]
}

/**
 * Report one locale file's state and collect everything that should fail the
 * check. `driftErrors` covers keys outside the manifest baseline: reporting
 * alone let a rename ship with every non-English locale silently falling back
 * to English.
 */
function inspectLocaleFile(state: LocaleFileState): LocaleCheckFindings {
  const label = `${state.locale.code}/${state.plan.filename}`
  const { pendingLeaves, strayPaths } = state

  if (pendingLeaves.length > 0) {
    const examples = pendingLeaves
      .slice(0, 5)
      .map((leaf) => leaf.path.join('.'))
      .join(', ')
    print(
      `${label}: ${pendingLeaves.length} strings need translation (${examples}${pendingLeaves.length > 5 ? ', …' : ''})`
    )
  }
  if (strayPaths.length > 0) {
    print(
      `${label}: ${strayPaths.length} keys no longer exist in the English source and will be pruned`
    )
  }

  // Keys queued because the English source changed are skipped (comparing an
  // old translation against new English is meaningless), as are baseline
  // violations recorded in the manifest; a key newly corrupted beyond those
  // must fail. Degraded plans (recorded source unavailable) cannot tell
  // staleness from corruption, so they skip the audit.
  const auditErrors = state.plan.degraded
    ? []
    : [
        ...auditProtectedLiterals(
          state.plan.source,
          state.existing,
          new Set([...state.plan.invalidated, ...state.plan.knownViolationKeys])
        )
      ].map((error) => `${label}: ${error}`)

  return {
    pending: pendingLeaves.length,
    stray: strayPaths.length,
    auditErrors,
    driftErrors: [
      ...unbaselinedDrift(
        label,
        pendingLeaves.map((leaf) => leaf.path),
        state.knownPendingKeys,
        'are missing a translation'
      ),
      ...unbaselinedDrift(
        label,
        strayPaths,
        state.knownStrayKeys,
        'no longer exist in the English source'
      )
    ]
  }
}

export function reportCheck(states: readonly LocaleFileState[]): number {
  const findings = states.map(inspectLocaleFile)
  const sum = (pick: (found: LocaleCheckFindings) => number): number =>
    findings.reduce((total, found) => total + pick(found), 0)
  const pendingTotal = sum((found) => found.pending)
  const strayTotal = sum((found) => found.stray)
  const auditErrors = findings.flatMap((found) => found.auditErrors)
  const driftErrors = findings.flatMap((found) => found.driftErrors)

  for (const error of auditErrors) print(error)
  for (const error of driftErrors) print(error)
  if (pendingTotal === 0 && strayTotal === 0 && auditErrors.length === 0) {
    print('All locales are up to date with the English sources.')
    return 0
  }
  print(
    `Pending: ${pendingTotal} translations, ${strayTotal} prunable keys, ${auditErrors.length} protected-token violations, ${driftErrors.length} unbaselined drift reports.`
  )
  if (driftErrors.length > 0) {
    print(
      'Run `pnpm locale` to translate the new keys and prune the stray ones, then commit src/locales and src/locales/.source-manifest.json.'
    )
  }
  return auditErrors.length > 0 || driftErrors.length > 0 ? 1 : 0
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
      previousLeafCount: collectLeaves(previous).size,
      degraded: recorded === undefined,
      knownViolationKeys: new Set(manifest.knownViolations?.[filename] ?? [])
    }
  })

  for (const plan of plans) {
    const summary = formatPruneSummary(
      plan.filename,
      plan.changes.deleted.length,
      plan.previousLeafCount
    )
    if (summary) print(summary)
  }

  const states = loadLocaleFileStates(
    config,
    outputDir,
    plans,
    manifest.knownPending,
    manifest.knownStray
  )
  const orphans = orphanedOutputFiles(outputDir, config, filenames)

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
  const pendingPlans = [...translationPlans].filter(
    ([, plan]) => plan.items.length > 0
  )
  const initialBatchCount = pendingPlans.reduce(
    (count, [, plan]) =>
      count +
      chunkItems(
        plan.items,
        config.maxItemsPerRequest,
        config.maxSourceCharsPerRequest
      ).length,
    0
  )
  const pendingLocaleCount = new Set(
    pendingPlans.map(([state]) => state.locale.code)
  ).size
  if (pendingTotal > 0) {
    print(
      `Translation preflight: ${pendingTotal} strings in ${initialBatchCount} initial batches across ${pendingLocaleCount} locales; retries and truncation splits can add requests.`
    )
  }

  if (check) {
    for (const orphan of orphans) {
      print(
        `${relative(repoRoot, orphan)}: the English source file was removed; this locale file will be deleted`
      )
    }
    process.exitCode = reportCheck(states)
    return
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (pendingTotal > 0 && !apiKey) {
    throw new Error(
      `${pendingTotal} strings need translation but OPENAI_API_KEY is not set.`
    )
  }
  const responseUsages: (ResponseUsage | undefined)[] = []
  const counter = createRequestCounter()
  const translateBatch: TranslateBatch = apiKey
    ? createOpenAiTranslator({
        apiKey,
        fetchFn: counter.fetch,
        model: config.model,
        reasoningEffort: config.reasoningEffort,
        glossary: config.glossary,
        maxTruncationSplitDepth: config.maxTruncationSplitDepth,
        onUsage: (usage) => {
          responseUsages.push(usage)
        }
      })
    : async () => {
        throw new Error('No translator available')
      }

  const outcomes = await mapWithConcurrency(
    states,
    config.localeFileConcurrency,
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

  if (counter.requestCount() > 0) {
    print(formatUsageSummary(responseUsages, counter.requestCount()))
  }

  const failuresByFile = new Map<string, string[]>()
  function addFailure(filename: string, message: string): void {
    failuresByFile.set(filename, [
      ...(failuresByFile.get(filename) ?? []),
      message
    ])
  }
  for (const outcome of outcomes) {
    if ('failure' in outcome) {
      addFailure(
        outcome.state.plan.filename,
        `${outcome.state.locale.code}/${outcome.state.plan.filename}: ${outcome.failure}`
      )
    }
  }
  const rebuilt = outcomes.flatMap((outcome) =>
    'output' in outcome ? [outcome] : []
  )
  for (const { state, output } of rebuilt) {
    for (const error of validateLocale(
      state.plan.source,
      output,
      state.plan.changes
    )) {
      addFailure(
        state.plan.filename,
        `${state.locale.code}/${state.plan.filename}: ${error}`
      )
    }
  }

  // Persist per entry file: locale outputs and the manifest entry advance only
  // for entry files whose every locale translated and validated, so one
  // failure does not discard the completed work of the other files
  const completedFilenames = new Set(
    filenames.filter((filename) => !failuresByFile.has(filename))
  )
  let written = 0
  for (const { state, output } of rebuilt) {
    if (!completedFilenames.has(state.plan.filename)) continue
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
  for (const orphan of orphans) rmSync(orphan)
  writeManifest(
    repoRoot,
    entryDir,
    manifestFile,
    [...completedFilenames],
    Object.fromEntries(
      filenames.flatMap((filename) => {
        if (completedFilenames.has(filename)) return []
        const hash = manifest.files[filename]
        return hash ? [[filename, hash] as const] : []
      })
    ),
    // A completed file's translations were fully revalidated, so its baseline
    // violations are healed and dropped; failed files keep theirs
    preservedBaseline(filenames, completedFilenames, manifest.knownViolations),
    // Likewise: a completed file has every pending key translated and every
    // stray key pruned, so its pending baseline is healed and dropped
    preservedPendingBaseline(completedFilenames, manifest.knownPending),
    preservedPendingBaseline(completedFilenames, manifest.knownStray)
  )

  if (failuresByFile.size > 0) {
    const details = [...failuresByFile.values()].flat()
    const persisted =
      completedFilenames.size > 0
        ? `\nCompleted entry files were written and recorded in the manifest: ${[...completedFilenames].join(', ')}.`
        : ''
    throw new Error(
      `Translation failed for ${details.length} locale files:\n${details.join('\n')}${persisted}`
    )
  }

  print(
    `Translated ${pendingTotal} strings; updated ${written} locale files across ${config.outputLocales.length} locales.`
  )
  if (orphans.length > 0) {
    print(
      `Deleted ${orphans.length} locale files whose English source was removed.`
    )
  }
  print(`Source provenance: ${relative(repoRoot, manifestFile)}`)
}

if (isMainModule(import.meta.url)) {
  run(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
