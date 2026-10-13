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
import { parseArgs } from 'node:util'

import { isEqual } from 'es-toolkit'
import type { ResponseUsage } from 'openai/resources/responses/responses'

import { auditCatalogSafety } from './catalog-validation'
import type {
  MessageGroup,
  OutputLocale,
  TranslationPipelineConfig
} from './config'
import { translationTargets } from './config'
import { partitionLocale } from './locale-retention'
import type {
  LocaleLeafEntry,
  LocaleObject,
  LocaleTrackedLeaf,
  LocaleValue
} from './locale-tree'
import {
  collectLeaves,
  collectPendingLeaves,
  diffLocaleSources,
  getLeaf,
  isTranslatableLeaf,
  parseLocale,
  pathKey,
  rebuildLocale,
  serializeLocale
} from './locale-tree'
import {
  auditLocaleTokens,
  formatTokenViolation,
  leafTokensDiffer,
  leafViolations,
  localizeLinks,
  protectedTokens
} from './protected-tokens'
import type { SourceManifest } from './source-manifest'
import { loadManifest, serializeManifest } from './source-manifest'
import type { TranslateBatch, TranslationItem } from './translate'
import {
  chunkItems,
  createOpenAiTranslator,
  createRequestCounter,
  mapWithConcurrency,
  translateLocaleItems
} from './translate'
import { isMainModule } from '../isMainModule'

interface SourcePlan {
  filename: string
  source: LocaleObject
  sourceLeaves: Map<string, LocaleLeafEntry>
  previous: LocaleObject
  recorded: boolean
  invalidated: Set<string>
  modified: Set<string>
  excluded: Set<string>
}

interface LocaleFileState extends ReturnType<typeof partitionLocale> {
  locale: OutputLocale
  plan: SourcePlan
  label: string
  outputFile: string
  existing: LocaleObject
  pendingLeaves: LocaleLeafEntry[]
  strayPaths: string[][]
}

interface ItemRef {
  leafKey: string
  indices: number[]
}

interface TranslationPlan {
  items: TranslationItem[]
  refs: Map<string, ItemRef>
}

export function buildTranslationItems(
  filename: string,
  pendingLeaves: readonly LocaleLeafEntry[],
  {
    strict = false,
    localize
  }: { strict?: boolean; localize?: (href: string) => string } = {}
): TranslationPlan {
  const items: TranslationItem[] = []
  const refs = new Map<string, ItemRef>()
  function addItem(
    leaf: LocaleLeafEntry,
    english: string,
    indices: number[]
  ): void {
    const source = localize ? localizeLinks(english, localize) : english
    const id = String(items.length + 1)
    const indexSuffix = indices.map((index) => `[${index}]`).join('')
    items.push({
      id,
      context: `${filename}: ${leaf.path.join('.')}${indexSuffix}`,
      source,
      preserve: protectedTokens(source, { strict })
    })
    refs.set(id, { leafKey: pathKey(leaf.path), indices })
  }
  function addArrayItems(
    leaf: LocaleLeafEntry,
    elements: readonly LocaleValue[],
    indices: number[]
  ): void {
    for (const [index, element] of elements.entries()) {
      if (typeof element === 'string' && element.trim().length > 0)
        addItem(leaf, element, [...indices, index])
      else if (Array.isArray(element))
        addArrayItems(leaf, element, [...indices, index])
    }
  }
  for (const leaf of pendingLeaves) {
    if (typeof leaf.value === 'string') addItem(leaf, leaf.value, [])
    else if (Array.isArray(leaf.value)) addArrayItems(leaf, leaf.value, [])
  }
  return { items, refs }
}

export function assembleLeafTranslations(
  pendingLeaves: readonly LocaleLeafEntry[],
  plan: TranslationPlan,
  translations: ReadonlyMap<string, string>
): Map<string, LocaleTrackedLeaf> {
  const assembled = new Map(
    pendingLeaves.map((leaf) => [
      pathKey(leaf.path),
      structuredClone(leaf.value)
    ])
  )
  for (const item of plan.items) {
    const ref = plan.refs.get(item.id)
    const translated = translations.get(item.id)
    if (!ref || translated === undefined)
      throw new Error(`Missing translation for item ${item.context}`)
    const leaf = assembled.get(ref.leafKey)
    if (leaf === undefined) throw new Error(`Unknown leaf for ${item.context}`)
    if (ref.indices.length === 0) {
      assembled.set(ref.leafKey, translated)
      continue
    }
    if (!Array.isArray(leaf))
      throw new Error(`Expected an array leaf for ${item.context}`)
    let container: LocaleValue[] = leaf
    for (const index of ref.indices.slice(0, -1)) {
      const next = container[index]
      if (!Array.isArray(next))
        throw new Error(`Expected a nested array for ${item.context}`)
      container = next
    }
    container[ref.indices.at(-1) ?? 0] = translated
  }
  return assembled
}

export function formatPruneSummary(
  filename: string,
  deletedCount: number,
  previousLeafCount: number
): string | undefined {
  if (deletedCount === 0) return
  return `WARNING: ${filename}: ${deletedCount} of ${previousLeafCount} English keys deleted; matching locale keys will be pruned.`
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

function print(line: string): void {
  process.stdout.write(`${line}\n`)
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
  return parseLocale(content, `${filename}@${hash}`)
}

function loadPlans(
  repoRoot: string,
  outputDir: string,
  manifest: SourceManifest,
  config: TranslationPipelineConfig,
  readCatalog: (file: string, required?: boolean) => LocaleObject
): SourcePlan[] {
  const entryDir = join(outputDir, 'en')
  return readdirSync(entryDir)
    .filter(
      (file) =>
        file.endsWith('.json') && statSync(join(entryDir, file)).isFile()
    )
    .sort()
    .map((filename) => {
      const source = readCatalog(join(entryDir, filename), true)
      const hash = Object.hasOwn(manifest.files, filename)
        ? manifest.files[filename]
        : undefined
      const recorded = hash ? readManifestSource(repoRoot, filename, hash) : {}
      if (recorded === undefined) {
        throw new Error(
          `Cannot read the recorded English source for ${filename} (${hash}). Run from a clone with full history (fetch-depth: 0 with filter: blob:none).`
        )
      }
      const previous = recorded
      const sourceLeaves = collectLeaves(source)
      const policy = config.existingCopy
      const excluded = new Set(
        [...sourceLeaves]
          .filter(
            ([, leaf]) =>
              policy.kind === 'preserve' &&
              policy.excludedKeyPrefixes.some(
                (prefix) =>
                  leaf.path.join('.') === prefix ||
                  leaf.path.join('.').startsWith(`${prefix}.`)
              )
          )
          .map(([key]) => key)
      )
      const changes = diffLocaleSources(previous, source)
      const invalidated = new Set(
        [...changes.added, ...changes.modified].map(pathKey)
      )
      const modified = new Set(changes.modified.map(pathKey))
      for (const group of config.messageGroups ?? []) {
        const keys = group.map((path) => pathKey([...path]))
        if (!keys.some((key) => invalidated.has(key))) continue
        for (const key of keys.filter((key) => sourceLeaves.has(key))) {
          invalidated.add(key)
          modified.add(key)
        }
      }
      const summary = formatPruneSummary(
        filename,
        changes.deleted.length,
        collectLeaves(previous).size
      )
      if (summary) print(summary)
      return {
        filename,
        source,
        sourceLeaves,
        previous,
        recorded: hash !== undefined,
        invalidated,
        modified,
        excluded
      }
    })
}

function loadStates(
  outputDir: string,
  plans: readonly SourcePlan[],
  config: TranslationPipelineConfig,
  readCatalog: (file: string, required?: boolean) => LocaleObject
): LocaleFileState[] {
  return config.outputLocales.flatMap((locale) =>
    plans.map((plan) => {
      const outputFile = join(outputDir, locale.code, plan.filename)
      const existing = readCatalog(outputFile)
      const retention = partitionLocale({
        sourceLeaves: plan.sourceLeaves,
        previousEnglish: plan.previous,
        existing,
        modifiedKeys: plan.modified,
        policy: config.existingCopy,
        excludedKeys: plan.excluded
      })
      const pendingLeaves = collectPendingLeaves(
        plan.source,
        existing,
        plan.invalidated,
        (source, target) =>
          leafTokensDiffer(source, target, {
            strict: config.strictProtectedTokens,
            localeCode: locale.code,
            localizeHref: config.localizeHref
          })
      ).filter(
        (leaf) =>
          !retention.retained.has(pathKey(leaf.path)) &&
          !retention.omitted.has(pathKey(leaf.path))
      )
      const strayPaths = [...collectLeaves(existing)]
        .filter(
          ([key]) => !plan.sourceLeaves.has(key) || retention.omitted.has(key)
        )
        .map(([, leaf]) => leaf.path)
      return {
        locale,
        plan,
        label: `${locale.code}/${plan.filename}`,
        outputFile,
        existing,
        ...retention,
        pendingLeaves,
        strayPaths
      }
    })
  )
}

function auditChangedLeaf(
  state: LocaleFileState,
  output: LocaleObject,
  config: TranslationPipelineConfig,
  key: string
) {
  const leaf = state.plan.sourceLeaves.get(key)
  if (!leaf) return []
  const previous = getLeaf(state.plan.previous, leaf.path)
  const target = getLeaf(output, leaf.path)
  if (previous === undefined || target === undefined) return []
  const options = {
    strict: config.strictProtectedTokens,
    localeCode: state.locale.code,
    localizeHref: config.localizeHref
  }
  const oldErrors = leafViolations(previous, target, leaf.path, options)
  return leafTokensDiffer(leaf.value, target, options) ? oldErrors : []
}

function groupMessage(catalog: LocaleObject, group: MessageGroup) {
  const values = group.map((path) => getLeaf(catalog, [...path]))
  return values.every((value) => typeof value === 'string')
    ? values.join(' ')
    : undefined
}

function auditChangedGroup(
  state: LocaleFileState,
  output: LocaleObject,
  config: TranslationPipelineConfig,
  group: MessageGroup
) {
  const current = groupMessage(state.plan.source, group)
  const target = groupMessage(output, group)
  if (current === undefined || target === undefined) return []
  const previous = groupMessage(state.plan.previous, group) ?? current
  const options = {
    strict: config.strictProtectedTokens,
    localeCode: state.locale.code,
    localizeHref: config.localizeHref
  }
  const oldErrors = leafViolations(previous, target, [...group[0]], options)
  return leafTokensDiffer(current, target, options) ? oldErrors : []
}

function auditChangedCopy(
  state: LocaleFileState,
  output: LocaleObject,
  config: TranslationPipelineConfig,
  skipped: ReadonlySet<string>
) {
  const groups = config.messageGroups ?? []
  const excluded = new Set([
    ...state.plan.excluded,
    ...[...state.retained]
      .filter(([, value]) => value === '')
      .map(([key]) => key),
    ...groups.flatMap((group) => group.map((path) => pathKey([...path])))
  ])
  return [
    ...[...state.plan.modified]
      .filter((key) => skipped.has(key) && !excluded.has(key))
      .flatMap((key) => auditChangedLeaf(state, output, config, key)),
    ...groups
      .filter((group) =>
        group.some((path) => state.plan.modified.has(pathKey([...path])))
      )
      .flatMap((group) => auditChangedGroup(state, output, config, group))
  ]
}

function auditState(
  state: LocaleFileState,
  output: LocaleObject,
  config: TranslationPipelineConfig,
  phase: 'check' | 'preflight' | 'output'
) {
  const replaced = [...state.plan.invalidated].filter(
    (key) => !state.retained.has(key)
  )
  if (phase === 'preflight')
    replaced.push(...state.pendingLeaves.map(({ path }) => pathKey(path)))
  const skipped = new Set([
    ...state.omitted,
    ...state.plan.excluded,
    ...[...state.retained]
      .filter(([, value]) => value === '')
      .map(([key]) => key),
    ...(phase === 'output' ? [] : replaced)
  ])
  const actual = auditLocaleTokens(state.plan.source, output, skipped, {
    strict: config.strictProtectedTokens,
    localeCode: state.locale.code,
    localizeHref: config.localizeHref,
    groups:
      phase === 'output'
        ? config.messageGroups
        : config.messageGroups?.filter(
            (group) =>
              !group.some((path) => replaced.includes(pathKey([...path])))
          )
  })
  if (phase === 'check')
    actual.push(...auditChangedCopy(state, output, config, skipped))
  const safety = auditCatalogSafety(
    output,
    state.plan.filename,
    phase === 'preflight' ? new Set(replaced) : new Set()
  )
  return { unexpected: actual, safety }
}

function reportState(
  state: LocaleFileState,
  config: TranslationPipelineConfig
) {
  const { label } = state
  if (state.pendingLeaves.length)
    print(
      `${label}: ${state.pendingLeaves.length} strings need translation (${state.pendingLeaves
        .slice(0, 5)
        .map(({ path }) => path.join('.'))
        .join(', ')})`
    )
  if (state.strayPaths.length)
    print(
      `${label}: ${state.strayPaths.length} keys will be pruned or use English fallback`
    )
  const audit = auditState(state, state.existing, config, 'check')
  for (const error of audit.safety) print(`${label}: ${error}`)
  for (const error of audit.unexpected)
    print(`${label}: ${formatTokenViolation(error)}`)
  return {
    pending: state.pendingLeaves.length,
    stray: state.strayPaths.length,
    violations: audit.unexpected.length,
    safetyErrors: audit.safety.length
  }
}

function catalogStatus(invalid: number, incomplete: number): string {
  if (invalid) return 'Catalog status: invalid.'
  return incomplete
    ? 'Catalog status: valid; translations pending.'
    : 'Catalog status: valid and complete.'
}

function catalogCheckExitCode(
  invalid: number,
  incomplete: number,
  complete: boolean
): number {
  return invalid || (complete && incomplete) ? 1 : 0
}

function reportCheck(
  states: readonly LocaleFileState[],
  config: TranslationPipelineConfig,
  sourceErrors: readonly string[],
  complete: boolean,
  orphanCount: number
): number {
  const missingStructure = states.flatMap((state) =>
    [...state.plan.sourceLeaves].filter(
      ([key, leaf]) =>
        !state.omitted.has(key) &&
        !isTranslatableLeaf(leaf.value) &&
        getLeaf(state.existing, leaf.path) === undefined
    )
  ).length
  const stale = [...new Set(states.map(({ plan }) => plan))].filter(
    (plan) => !plan.recorded || !isEqual(plan.source, plan.previous)
  )
  for (const plan of stale)
    print(`${plan.filename}: English source provenance needs updating`)
  for (const error of sourceErrors) print(error)
  const reports = states.map((state) => reportState(state, config))
  const pending = reports.reduce((total, report) => total + report.pending, 0)
  const stray = reports.reduce((total, report) => total + report.stray, 0)
  const violations = reports.reduce(
    (total, report) => total + report.violations,
    0
  )
  const safetyErrors =
    sourceErrors.length +
    reports.reduce((total, report) => total + report.safetyErrors, 0)
  if (
    [
      pending,
      stray,
      violations,
      safetyErrors,
      orphanCount,
      stale.length,
      missingStructure
    ].every((count) => count === 0)
  )
    print('All locales are up to date with the English sources.')
  else
    print(
      `Pending: ${pending} translations, ${stray} prunable keys, ${violations} protected-token violations.`
    )
  if (safetyErrors) print(`Catalog safety errors: ${safetyErrors}.`)
  if (missingStructure)
    print(`Missing non-translatable leaves: ${missingStructure}.`)
  const incomplete =
    pending + stray + orphanCount + stale.length + missingStructure
  const invalid = violations + safetyErrors
  print(catalogStatus(invalid, incomplete))
  if (complete && incomplete)
    print('Complete catalogs are required for this delivery gate.')
  return catalogCheckExitCode(invalid, incomplete, complete)
}

export function parseOptions(argv: readonly string[]) {
  const { values } = parseArgs({
    args: [...argv],
    options: {
      target: { type: 'string', default: 'app' },
      check: { type: 'boolean', default: false },
      complete: { type: 'boolean', default: false },
      locales: { type: 'string' }
    }
  })
  const name = values.target
  if (name !== 'app' && name !== 'website')
    throw new Error(
      `Unknown translation target "${name}"; expected app or website.`
    )
  if ((values.complete || values.locales) && !values.check)
    throw new Error('--complete and --locales require --check.')
  const config = translationTargets[name]
  const selected = values.locales?.split(',')
  if (
    selected?.some(
      (code) => !config.outputLocales.some((locale) => locale.code === code)
    )
  )
    throw new Error(`Unknown output locale in "${values.locales}".`)
  return {
    config: selected
      ? {
          ...config,
          outputLocales: config.outputLocales.filter(({ code }) =>
            selected.includes(code)
          )
        }
      : config,
    check: values.check,
    complete: values.complete
  }
}

export async function updateLocales({
  repoRoot,
  config,
  check,
  complete = false,
  translateBatch
}: {
  repoRoot: string
  config: TranslationPipelineConfig
  check: boolean
  complete?: boolean
  translateBatch?: TranslateBatch
}): Promise<number> {
  const outputDir = resolve(repoRoot, config.output)
  const manifestFile = join(outputDir, '.source-manifest.json')
  const inputs = new Map<string, string | null>()
  function readInput(file: string): string | null {
    const contents = existsSync(file) ? readFileSync(file, 'utf8') : null
    inputs.set(file, contents)
    return contents
  }
  function readCatalog(file: string, required = false): LocaleObject {
    const contents = readInput(file)
    if (contents === null) {
      if (required)
        throw new Error(
          `Missing catalog ${file}. Restore it from version control.`
        )
      return {}
    }
    return parseLocale(contents, file)
  }
  const manifestBytes = readInput(manifestFile)
  if (manifestBytes === null)
    throw new Error(
      `Missing source manifest ${manifestFile}. Restore it from version control.`
    )
  const manifest = loadManifest(manifestFile, manifestBytes)
  const plans = loadPlans(repoRoot, outputDir, manifest, config, readCatalog)
  if (!plans.length)
    throw new Error(`No English catalogs found in ${outputDir}.`)
  const states = loadStates(outputDir, plans, config, readCatalog)
  const filenames = new Set(plans.map(({ filename }) => filename))
  const directories = config.outputLocales.map(({ code }) =>
    join(outputDir, code)
  )
  const orphans = directories.flatMap((directory) => {
    return existsSync(directory)
      ? readdirSync(directory)
          .filter((file) => file.endsWith('.json') && !filenames.has(file))
          .map((file) => join(directory, file))
      : []
  })
  const sourceErrors = plans.flatMap((plan) =>
    auditCatalogSafety(plan.source, plan.filename).map(
      (error) => `en/${plan.filename}: ${error}`
    )
  )
  if (check) {
    for (const orphan of orphans)
      print(
        `${relative(repoRoot, orphan)}: the English source file was removed; this locale file will be deleted`
      )
    const staleManifestFiles = Object.keys(manifest.files).filter(
      (filename) => !filenames.has(filename)
    )
    for (const filename of staleManifestFiles)
      print(
        `${filename}: removed English source is still recorded in the manifest`
      )
    return reportCheck(
      states,
      config,
      sourceErrors,
      complete,
      orphans.length + staleManifestFiles.length
    )
  }

  if (sourceErrors.length)
    throw new Error(
      `Fix English catalogs before generation:\n${sourceErrors.join('\n')}`
    )

  for (const orphan of orphans) readInput(orphan)
  const { outcomes, pending } = await translateStates(
    states,
    config,
    translateBatch
  )
  const written = writeOutcomes({
    repoRoot,
    outputDir,
    manifest,
    plans,
    outcomes,
    orphans,
    inputs
  })
  print(
    `Translated ${pending} strings; updated ${written} files across ${config.outputLocales.length} locales.`
  )
  print(`Source provenance: ${relative(repoRoot, manifestFile)}`)
  return 0
}

type TranslationOutcome =
  | { state: LocaleFileState; output: LocaleObject }
  | { state: LocaleFileState; failure: string }

async function translateStates(
  states: readonly LocaleFileState[],
  config: TranslationPipelineConfig,
  translateBatch?: TranslateBatch
): Promise<{ outcomes: TranslationOutcome[]; pending: number }> {
  const preflight = states.flatMap((state) => {
    const audit = auditState(state, state.existing, config, 'preflight')
    return [...audit.unexpected.map(formatTokenViolation), ...audit.safety].map(
      (error) => `${state.label}: ${error}`
    )
  })
  if (preflight.length)
    throw new Error(
      `Fix retained copy before generation:\n${preflight.join('\n')}`
    )
  const { localizeHref } = config
  const tasks = states.map((state) => ({
    state,
    translation: buildTranslationItems(
      state.plan.filename,
      state.pendingLeaves,
      {
        strict: config.strictProtectedTokens,
        localize:
          localizeHref && ((href) => localizeHref(href, state.locale.code))
      }
    )
  }))
  const pending = tasks.reduce(
    (total, { translation }) => total + translation.items.length,
    0
  )
  const batches = tasks.reduce(
    (total, { translation }) =>
      total +
      chunkItems(
        translation.items,
        config.maxItemsPerRequest,
        config.maxSourceCharsPerRequest
      ).length,
    0
  )
  print(
    `Translation preflight: ${pending} strings in ${batches} initial batches; retries and truncation splits can add requests.`
  )
  const apiKey = process.env.OPENAI_API_KEY
  if (pending && !translateBatch && !apiKey)
    throw new Error(
      `${pending} strings need translation but OPENAI_API_KEY is not set.`
    )
  const usages: (ResponseUsage | undefined)[] = []
  const counter = createRequestCounter()
  const translator =
    translateBatch ??
    (apiKey
      ? createOpenAiTranslator({
          apiKey,
          fetchFn: counter.fetch,
          model: config.model,
          reasoningEffort: config.reasoningEffort,
          translationContext: config.translationContext,
          glossary: config.glossary,
          strictProtectedTokens: config.strictProtectedTokens,
          maxTruncationSplitDepth: config.maxTruncationSplitDepth,
          onUsage: (usage) => usages.push(usage)
        })
      : async () => {
          throw new Error('No translator available')
        })
  const outcomes = await mapWithConcurrency(
    tasks,
    config.localeFileConcurrency,
    async ({ state, translation }): Promise<TranslationOutcome> => {
      try {
        const translated = translation.items.length
          ? await translateLocaleItems(
              state.locale,
              translation.items,
              translator,
              config
            )
          : new Map<string, string>()
        const values = new Map([
          ...state.retained,
          ...assembleLeafTranslations(
            state.pendingLeaves,
            translation,
            translated
          )
        ])
        const output = rebuildLocale(
          state.plan.source,
          state.existing,
          state.plan.invalidated,
          values,
          state.omitted
        )
        const audit = auditState(state, output, config, 'output')
        const errors = [
          ...audit.unexpected.map(formatTokenViolation),
          ...audit.safety
        ]
        if (errors.length) throw new Error(errors.join('\n'))
        return { state, output }
      } catch (error) {
        return {
          state,
          failure: error instanceof Error ? error.message : String(error)
        }
      }
    }
  )
  if (counter.requestCount())
    print(formatUsageSummary(usages, counter.requestCount()))
  return { outcomes, pending }
}

function writeOutcomes({
  repoRoot,
  outputDir,
  manifest,
  plans,
  outcomes,
  orphans,
  inputs
}: {
  repoRoot: string
  outputDir: string
  manifest: SourceManifest
  plans: readonly SourcePlan[]
  outcomes: readonly TranslationOutcome[]
  orphans: readonly string[]
  inputs: ReadonlyMap<string, string | null>
}): number {
  const entryDir = join(outputDir, 'en')
  const manifestFile = join(outputDir, '.source-manifest.json')
  const failures = outcomes.filter((outcome) => 'failure' in outcome)
  const failedFiles = new Set(failures.map(({ state }) => state.plan.filename))
  const completed = outcomes.filter((outcome) => 'output' in outcome)
  const updates = new Map<string, string | null>()
  const files = Object.fromEntries(
    Object.entries(manifest.files).filter(([name]) => failedFiles.has(name))
  )
  const knownViolations = Object.fromEntries(
    Object.entries(manifest.knownViolations ?? {}).filter(([name]) =>
      failedFiles.has(name)
    )
  )
  for (const plan of plans.filter(
    ({ filename }) => !failedFiles.has(filename)
  )) {
    const sourceBytes = serializeLocale(plan.source)
    files[plan.filename] = execFileSync(
      'git',
      ['hash-object', '-w', '--stdin'],
      {
        cwd: repoRoot,
        input: sourceBytes,
        encoding: 'utf8'
      }
    ).trim()
    updates.set(join(entryDir, plan.filename), sourceBytes)
    for (const { state, output } of completed.filter(
      ({ state }) => state.plan === plan
    )) {
      const bytes = serializeLocale(output)
      updates.set(state.outputFile, bytes)
    }
  }
  for (const orphan of orphans) updates.set(orphan, null)
  updates.set(
    manifestFile,
    serializeManifest({ version: 1, files, knownViolations })
  )
  const written = writeCatalogUpdates(updates, inputs)
  if (failures.length)
    throw new Error(
      `Translation failed for ${failures.length} locale files:\n${failures.map(({ state, failure }) => `${state.label}: ${failure}`).join('\n')}\nAll locale results for ${[...failedFiles].join(', ')} were discarded together. Other entry files were written and recorded in the manifest.`
    )
  return written
}

function writeCatalogUpdates(
  updates: ReadonlyMap<string, string | null>,
  inputs: ReadonlyMap<string, string | null>
): number {
  for (const [file, original] of inputs) {
    const current = existsSync(file) ? readFileSync(file, 'utf8') : null
    if (current !== original)
      throw new Error(
        `${file} changed during translation. No files were written; rerun against the edited catalogs.`
      )
  }
  let written = 0
  for (const [file, contents] of updates) {
    if (contents === inputs.get(file)) continue
    if (contents === null) rmSync(file)
    else {
      mkdirSync(dirname(file), { recursive: true })
      writeFileSync(file, contents)
      written++
    }
  }
  return written
}

if (isMainModule(import.meta.url)) {
  async function run() {
    const options = parseOptions(process.argv.slice(2))
    process.exitCode = await updateLocales({
      repoRoot: resolve(import.meta.dirname, '../..'),
      ...options
    })
  }
  run().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
