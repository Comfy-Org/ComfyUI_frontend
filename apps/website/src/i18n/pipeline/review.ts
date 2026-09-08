/**
 * The JUDGEMENT layer for the marketing translation pipeline.
 *
 * `validate.ts` answers "did the model break a rule we wrote down". It cannot
 * answer "is this good Japanese", and that second question is the one marketing
 * copy actually fails: a brand nobody had added to the glossary yet, a sentence
 * claiming something the English never claimed, a heading translated as prose, a
 * term rendered one way in a hero and another way in the button below it. None
 * of those is expressible as a regex, so they need a model that reads both
 * languages.
 *
 * Findings carry an MQM-style grade — category, severity, and the offending span
 * — rather than a score out of ten, because a score is neither reviewable nor
 * actionable. You cannot prune "6/10"; you can prune "this says Flux where the
 * English says Wan 3.0".
 *
 * Critical and major findings become `Violation`s and flow into the EXISTING
 * prune in `enforce.ts`: the key is dropped, the resolver renders English, and
 * the page stays as it was. So a bad translation can never reach a reader, and
 * this module adds no new gating concept of its own.
 *
 * Everything here is pure. The Anthropic SDK, the filesystem and the API key
 * live in `scripts/i18n/review-translations.ts`, so these rules are tested
 * without any of the three.
 *
 * Ported from the hub's `review-translations.ts`, with one structural change.
 * The hub reviews a workflow entry — title, description and FAQ together — and
 * caches a verdict per entry. Marketing copy is a flat key/string map with no
 * such natural unit, so verdicts are cached per KEY and keys are batched into
 * requests by namespace. Caching per key rather than per batch matters: batch
 * membership shifts whenever a key is added, and a batch-keyed cache would
 * re-review a whole page over one new string.
 */
import { createHash } from 'node:crypto'

import type { Locale } from '../../config/locales'
import type { EnglishSource, TranslationLayer } from './types'
import type { Violation } from './validate'

/**
 * Bumping this invalidates every stored verdict and forces a full re-review.
 * That is a deliberate, billable action: change it only when the rubric below
 * changes, because verdicts reached under an older rubric are not comparable
 * with verdicts reached under this one.
 */
export const PROMPT_VERSION = 1

/**
 * Reviewer model.
 *
 * Deliberately a different family from the translator, which is OpenAI (see
 * `websiteTranslationConfig`). A model grading its own output is a weak check;
 * an independent second reader is the point of this layer. Opus rather than a
 * smaller tier because a false verdict here removes real copy from a real page.
 */
const DEFAULT_REVIEW_MODEL = 'claude-opus-5'

/**
 * Resolve the reviewer model from its env override, treating blank as unset.
 *
 * The workflow passes this through from a repository variable, and GitHub
 * renders an unset `vars.X` as an empty string rather than omitting it. With
 * `??` that empty string is accepted as a deliberate choice and every request
 * then fails on an empty model name. Because the review step is
 * continue-on-error, that failure does not stop the pipeline: it reports every
 * key unreviewable and the run still reports success, so a whole locale comes
 * back with nothing reviewed and nothing obviously wrong.
 */
export function resolveReviewModel(raw: string | undefined): string {
  return raw?.trim() || DEFAULT_REVIEW_MODEL
}

/**
 * Read a positive integer from an env string, falling back when it is not one.
 *
 * A bare `Number()` fails silently and dangerously here. `NaN` for the key
 * ceiling makes `total > NaN` false forever, so the cost guard stops guarding.
 * `NaN` or `0` for concurrency is worse: the pool builds zero runners, the
 * locale finishes with no calls made and no failures recorded, and its state is
 * written as though every key had been reviewed and found clean.
 */
export function parsePositiveInt(
  raw: string | undefined,
  fallback: number,
  name: string
): number {
  if (raw == null || raw.trim() === '') return fallback
  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed < 1) {
    console.warn(
      `[i18n] review: ignoring invalid ${name}=${JSON.stringify(raw)} ` +
        `(want a positive integer) — using ${fallback}.`
    )
    return fallback
  }
  return parsed
}

type FindingCategory = 'terminology' | 'accuracy' | 'fluency' | 'context'
type FindingSeverity = 'critical' | 'major' | 'minor'

export interface Finding {
  key: string
  category: FindingCategory
  severity: FindingSeverity
  /** The offending text, copied verbatim from the translation. */
  span: string
  /** The corrected text the reviewer proposes. */
  suggestion: string
  /** One sentence, in English, so a non-speaker can triage without the language. */
  reason: string
}

interface KeyVerdict {
  /** Hash of (English, translation, promptVersion) — the incremental key. */
  hash: string
  findings: Finding[]
}

export interface ReviewState {
  promptVersion: number
  /**
   * Fingerprint of the rubric the stored verdicts were reached under.
   *
   * The preserve terms and the locale's voice guidance are part of the rubric
   * but cannot go in `keyHash`: they are identical for every key in a locale, so
   * they belong here beside `promptVersion`. Absent on state written before this
   * field existed, which is read as "unknown, re-review".
   */
  glossary?: string
  entries: Record<string, KeyVerdict>
}

const CATEGORIES: readonly FindingCategory[] = [
  'terminology',
  'accuracy',
  'fluency',
  'context'
]
const SEVERITIES: readonly FindingSeverity[] = ['critical', 'major', 'minor']

/**
 * Severities that cost a key its translation.
 *
 * `minor` is recorded for the report but never prunes: dropping a whole string
 * over a comma hands the reader English instead of a translation the reviewer
 * itself called merely improvable, which is worse than the nit.
 */
const PRUNING_SEVERITIES: ReadonlySet<FindingSeverity> =
  new Set<FindingSeverity>(['critical', 'major'])

/**
 * Identity of a review. Covers the English source AND the translation AND the
 * rubric version, so a key is re-reviewed when any of the three moves and
 * skipped when none has — which is what keeps a nightly run to a few calls.
 */
export function keyHash(
  english: string,
  translated: string,
  promptVersion: number = PROMPT_VERSION
): string {
  return createHash('sha256')
    .update(JSON.stringify({ english, translated, promptVersion }))
    .digest('hex')
    .slice(0, 32)
}

/**
 * Identity of the rubric a review was reached under.
 *
 * Terms are sorted so their order in the glossary file cannot change the
 * fingerprint, and the locale's guidance is included because changing how
 * Japanese headings should read is as much a rubric change as adding a term.
 */
export function glossaryFingerprint(
  preserveTerms: readonly string[],
  guidance: string
): string {
  return createHash('sha256')
    .update(JSON.stringify({ terms: [...preserveTerms].sort(), guidance }))
    .digest('hex')
    .slice(0, 32)
}

/**
 * The keys whose verdict is missing or stale. Everything else already has a
 * verdict for this exact (English, translation, rubric) triple and is reused.
 */
export function selectKeysForReview(
  english: EnglishSource,
  translated: TranslationLayer,
  state: ReviewState
): string[] {
  const stale: string[] = []
  for (const key of Object.keys(translated).sort()) {
    // No English counterpart is the validator's `unknown-key` case. Reviewing it
    // would spend a call restating a problem already reported. Asked of the
    // object, because a `Record` type claims every key is present.
    if (!Object.hasOwn(english, key)) continue
    if (
      !Object.hasOwn(state.entries, key) ||
      state.entries[key].hash !== keyHash(english[key], translated[key])
    ) {
      stale.push(key)
    }
  }
  return stale
}

/**
 * Drop verdicts for keys that no longer exist, so the state file cannot grow
 * without bound as copy is rewritten and pages are retired.
 */
export function pruneOrphanedVerdicts(
  state: ReviewState,
  translated: TranslationLayer
): ReviewState {
  const entries: Record<string, KeyVerdict> = {}
  for (const [key, verdict] of Object.entries(state.entries)) {
    if (Object.hasOwn(translated, key)) entries[key] = verdict
  }
  return {
    promptVersion: state.promptVersion,
    glossary: state.glossary,
    entries
  }
}

export interface BatchLimits {
  /** Source + translation characters per request. */
  maxChars: number
  /** Keys per request, however short they are. */
  maxKeys: number
}

/**
 * Matches the translator's own per-request budget (`websiteTranslationConfig`),
 * so the reviewer reads copy in the same portions the translator wrote it.
 */
export const DEFAULT_BATCH_LIMITS: BatchLimits = { maxChars: 6000, maxKeys: 25 }

/**
 * Group keys into requests.
 *
 * Batches are a unit of judgement, not only of transport. The reviewer is asked
 * whether a term is rendered consistently across copy a reader sees together, so
 * a batch never spans two namespaces: an inconsistency between two pages nobody
 * reads side by side is not a defect, and inviting findings about it would spend
 * the budget on noise.
 */
export function planBatches(
  keys: readonly string[],
  english: EnglishSource,
  translated: TranslationLayer,
  limits: BatchLimits = DEFAULT_BATCH_LIMITS
): string[][] {
  const byNamespace = new Map<string, string[]>()
  for (const key of keys) {
    const namespace = key.split('.')[0]
    const group = byNamespace.get(namespace)
    if (group) group.push(key)
    else byNamespace.set(namespace, [key])
  }

  const batches: string[][] = []
  for (const group of byNamespace.values()) {
    let batch: string[] = []
    let chars = 0
    for (const key of group) {
      const size = key.length + english[key].length + translated[key].length
      // The emptiness test comes first, so a key larger than the whole budget
      // travels alone rather than being dropped. One story section body is
      // longer than a request, and dropping it would leave the longest prose on
      // the site permanently unreviewed.
      if (
        batch.length > 0 &&
        (chars + size > limits.maxChars || batch.length >= limits.maxKeys)
      ) {
        batches.push(batch)
        batch = []
        chars = 0
      }
      batch.push(key)
      chars += size
    }
    if (batch.length > 0) batches.push(batch)
  }
  return batches
}

/**
 * The shape the model's answer is constrained to. Structured output means the
 * answer is machine-usable by construction, with no prose parsing to get wrong.
 *
 * `key` cannot be an enum the way the hub enumerates its four fields — there are
 * thousands of keys and the list differs per request — so the guard against an
 * invented key lives in `parseFindings` instead.
 */
export const FINDINGS_SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          category: { type: 'string', enum: [...CATEGORIES] },
          severity: { type: 'string', enum: [...SEVERITIES] },
          span: { type: 'string' },
          suggestion: { type: 'string' },
          reason: { type: 'string' }
        },
        required: [
          'key',
          'category',
          'severity',
          'span',
          'suggestion',
          'reason'
        ],
        additionalProperties: false
      }
    }
  },
  required: ['findings'],
  additionalProperties: false
} as const

export interface SystemPromptInput {
  locale: Locale
  /** How the language is named to the model, e.g. `Japanese`. */
  localeName: string
  /** The locale's voice guidance, the same text the translator is given. */
  guidance: string
  preserveTerms: readonly string[]
}

/**
 * The rubric. Identical for every request in a locale, so it is sent once as a
 * cached system prompt and read back at a fraction of the price on each call.
 *
 * The banned-hype list is stated here as well as in the translator's glossary
 * because the deterministic check only catches the English words. A Japanese
 * rendering of "unlock your creativity" passes every regex we have.
 */
export function buildSystemPrompt({
  locale,
  localeName,
  guidance,
  preserveTerms
}: SystemPromptInput): string {
  return `You are a professional translation reviewer for comfy.org, the marketing site for ComfyUI, a node-based interface for generative AI. You review English → ${localeName} (${locale}) translations of marketing and SEO copy.

Report ONLY real defects. An acceptable translation whose word choice differs from yours is NOT a defect — do not invent findings to look thorough. An empty findings array is the correct answer for good copy.

The strings in one request belong to the same page or section and are read together, so a term rendered one way in a heading and another way in the body below it is a defect even when each is defensible alone.

Categories:
- terminology: a proper noun that must stay English was translated or altered, or a technical term is inconsistent with the rest of the request.
- accuracy: the translation states something the English does not, omits something it does, or contradicts it — a wrong model name, a wrong number, a capability the English never claimed.
- fluency: grammar, orthography or phrasing a native speaker would not write. Includes mixing Simplified and Traditional Chinese.
- context: technically correct but wrong for where it appears — a button label translated as a sentence, a heading translated as prose, a legal line translated as marketing.

Severity:
- critical: changes meaning, or would embarrass us publicly. Wrong product name, reversed meaning, broken script.
- major: clearly wrong to a native speaker and would need fixing before publication. Includes hype the English did not claim: no local equivalent of stunning, powerful, seamless, effortless, unlock, revolutionary, game-changing, cutting-edge or unleash.
- minor: a nit. Style or preference. Correct but improvable.

These proper nouns must appear EXACTLY as in English, never translated or transliterated:
${preserveTerms.join(', ')}

Voice for this locale, which the translator was also given:
${guidance}

Every finding must name the "key" it is about, exactly as given. "span" must be copied verbatim from the translation so it can be located, and "reason" must be in English so a reviewer who does not read ${localeName} can triage it.`
}

/** One request: the English source beside the translation, key by key. */
export function buildUserPrompt(
  keys: readonly string[],
  english: EnglishSource,
  translated: TranslationLayer
): string {
  const lines: string[] = []
  for (const key of keys) {
    lines.push(`## ${key}`)
    lines.push(`EN: ${JSON.stringify(english[key])}`)
    lines.push(`TRANSLATION: ${JSON.stringify(translated[key])}`)
    lines.push('')
  }
  return lines.join('\n')
}

/**
 * Keep only well-formed findings. A model that invents a key or an unheard-of
 * severity must not be able to prune real copy, so anything unrecognised is
 * dropped rather than trusted.
 *
 * `allowed` is optional because stored verdicts go through this too, and a
 * verdict written last week names a key that may legitimately be gone now.
 */
function sanitizeFindings(
  list: readonly unknown[],
  allowed?: ReadonlySet<string>
): Finding[] {
  const findings: Finding[] = []
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const raw = item as Record<string, unknown>
    const key = raw.key
    if (typeof key !== 'string') continue
    if (allowed && !allowed.has(key)) continue
    if (!CATEGORIES.includes(raw.category as FindingCategory)) continue
    if (!SEVERITIES.includes(raw.severity as FindingSeverity)) continue
    findings.push({
      key,
      category: raw.category as FindingCategory,
      severity: raw.severity as FindingSeverity,
      span: typeof raw.span === 'string' ? raw.span : '',
      suggestion: typeof raw.suggestion === 'string' ? raw.suggestion : '',
      reason: typeof raw.reason === 'string' ? raw.reason : ''
    })
  }
  return findings
}

export function parseFindings(
  raw: unknown,
  keys: readonly string[]
): Finding[] {
  const list = (raw as { findings?: unknown } | null)?.findings
  if (!Array.isArray(list)) return []
  return sanitizeFindings(list, new Set(keys))
}

/**
 * A stored verdict: the hash alone when the text was found clean, the whole
 * object when it was not.
 *
 * Nine keys in ten come back clean, and writing each of those as an object
 * wrapping an empty array cost 292K of the Japanese file's 371K. A clean verdict
 * IS its hash. It also reads better in a pull request: two thousand one-line
 * entries let the handful of real findings stand out, where two thousand
 * four-line stanzas bury them.
 */
type StoredVerdict = string | KeyVerdict

export interface SerializedReviewState {
  promptVersion: number
  glossary?: string
  entries: Record<string, StoredVerdict>
}

/**
 * The on-disk shape. Paired with `loadReviewState` in this file so the writer
 * and the reader cannot drift into disagreeing about it.
 *
 * Keys are sorted, because they are otherwise written in whatever order the
 * batches came back in, and a reshuffled two-thousand-line diff hides the two
 * lines that actually changed.
 */
export function serializeReviewState(
  state: ReviewState
): SerializedReviewState {
  const entries: Record<string, StoredVerdict> = {}
  for (const key of Object.keys(state.entries).sort()) {
    const verdict = state.entries[key]
    entries[key] = verdict.findings.length > 0 ? verdict : verdict.hash
  }
  return {
    promptVersion: state.promptVersion,
    glossary: state.glossary,
    entries
  }
}

/**
 * Read stored verdicts, discarding anything that does not describe the rubric in
 * force now.
 *
 * The state file is generated but committed, so it can arrive truncated or
 * hand-edited. Trusting its shape lets a non-array `findings` reach a `for…of`
 * and take down the run, or a bad severity reach `summarize` and report NaN.
 * Takes the parsed value rather than a path so the rules are testable without a
 * filesystem.
 */
export function loadReviewState(
  stored: unknown,
  glossary?: string
): ReviewState {
  // Typed as what it is — a parsed JSON file — rather than as the shape we
  // meant to write. Describing it as `SerializedReviewState` would make every
  // check below look redundant to a type-aware linter, and the honest answer is
  // that a committed, hand-editable file owes us nothing.
  const state = stored as {
    promptVersion?: unknown
    glossary?: unknown
    entries?: Record<string, unknown>
  } | null

  // A rubric change makes every stored verdict incomparable, so discard them all
  // rather than mixing two rubrics in one report.
  if (
    !state ||
    state.promptVersion !== PROMPT_VERSION ||
    (glossary != null && state.glossary !== glossary)
  ) {
    return { promptVersion: PROMPT_VERSION, glossary, entries: {} }
  }

  const entries: Record<string, KeyVerdict> = {}
  for (const [key, raw] of Object.entries(state.entries ?? {})) {
    // The long form is still read, because the committed files predate the
    // compact one and a locale must not lose its whole cache to a format change.
    if (typeof raw === 'string') {
      if (raw !== '') entries[key] = { hash: raw, findings: [] }
      continue
    }
    if (!raw || typeof raw !== 'object') continue
    const verdict = raw as { hash?: unknown; findings?: unknown }
    if (typeof verdict.hash !== 'string') continue
    if (!Array.isArray(verdict.findings)) continue
    entries[key] = {
      hash: verdict.hash,
      findings: sanitizeFindings(verdict.findings)
    }
  }
  // A caller with no rubric to declare (a report, an ad-hoc read) must not erase
  // the fingerprint the last real run recorded.
  const recorded =
    typeof state.glossary === 'string' ? state.glossary : undefined
  return {
    promptVersion: PROMPT_VERSION,
    glossary: glossary ?? recorded,
    entries
  }
}

/**
 * Turn stored verdicts into the validator's own `Violation` shape, so the
 * existing prune consumes them unchanged and a key dropped for bad grammar
 * behaves exactly like one dropped for a lost brand name.
 *
 * `english` and `translated` are required rather than optional so the freshness
 * check cannot be skipped. A verdict describes one exact (source, translation)
 * pair; acting on one whose hash no longer matches would prune text that may
 * well have fixed the very problem the verdict describes.
 */
export function reviewViolations(
  locale: Locale,
  state: ReviewState,
  english: EnglishSource,
  translated: TranslationLayer
): Violation[] {
  const violations: Violation[] = []
  for (const [key, verdict] of Object.entries(state.entries)) {
    // Asked of the objects rather than of their types: a `Record` claims every
    // key is present, and a verdict routinely outlives the key it judged.
    if (!Object.hasOwn(english, key) || !Object.hasOwn(translated, key))
      continue
    const source = english[key]
    const value = translated[key]
    if (verdict.hash !== keyHash(source, value)) continue
    for (const finding of verdict.findings) {
      if (!PRUNING_SEVERITIES.has(finding.severity)) continue
      violations.push({
        key,
        locale,
        kind: 'ai-review',
        detail: `${finding.category}/${finding.severity}: ${finding.reason}`
      })
    }
  }
  return violations
}

export interface ReviewSummary {
  keys: number
  findings: number
  bySeverity: Record<FindingSeverity, number>
  byCategory: Record<FindingCategory, number>
}

/** Counts for the run log and the pull request summary. */
export function summarize(state: ReviewState): ReviewSummary {
  const bySeverity: Record<FindingSeverity, number> = {
    critical: 0,
    major: 0,
    minor: 0
  }
  const byCategory: Record<FindingCategory, number> = {
    terminology: 0,
    accuracy: 0,
    fluency: 0,
    context: 0
  }
  let findings = 0
  for (const verdict of Object.values(state.entries)) {
    for (const finding of verdict.findings) {
      findings += 1
      bySeverity[finding.severity] += 1
      byCategory[finding.category] += 1
    }
  }
  return {
    keys: Object.keys(state.entries).length,
    findings,
    bySeverity,
    byCategory
  }
}

/** Run `worker` over `items` with a bounded number in flight. */
async function pooled<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  let cursor = 0
  const runners = Array.from(
    { length: Math.max(1, Math.min(limit, items.length)) },
    async () => {
      while (cursor < items.length) {
        await worker(items[cursor++])
      }
    }
  )
  await Promise.all(runners)
}

/**
 * Reviews one batch. Returns the findings, or `null` when the batch could not be
 * reviewed at all — an API error, a refusal, a truncated answer.
 *
 * `null` is deliberately not the same as `[]`. An empty array is a verdict of
 * "this is clean" and gets stored; an unreviewable batch must keep whatever
 * verdict it had and be retried next run, or a transient outage silently marks a
 * locale as reviewed.
 */
export type ReviewBatchFn = (keys: string[]) => Promise<Finding[] | null>

export interface ReviewResult {
  state: ReviewState
  /** Keys that came back with a verdict this run. */
  reviewed: number
  failures: string[]
}

interface BatchProgress {
  done: number
  total: number
  keys: readonly string[]
  /** Findings returned, or null when the batch could not be reviewed at all. */
  findings: number | null
}

export interface ReviewOptions extends Partial<BatchLimits> {
  concurrency?: number
  /**
   * Called once per batch, as it lands.
   *
   * A full first pass is 170-odd requests over an hour. Without this the step
   * prints one line and then nothing until it ends, so a hung run and a working
   * one look identical for the whole of it.
   */
  onBatch?: (progress: BatchProgress) => void
}

/**
 * Review everything stale in a locale and fold the verdicts into the state.
 *
 * Takes the per-batch reviewer as a parameter, so the flow that decides what
 * ends up pruned is exercised in tests without a network call or an API key.
 */
export async function reviewAll(
  english: EnglishSource,
  translated: TranslationLayer,
  priorState: ReviewState,
  reviewBatch: ReviewBatchFn,
  options: ReviewOptions = {}
): Promise<ReviewResult> {
  const state = pruneOrphanedVerdicts(priorState, translated)
  const stale = selectKeysForReview(english, translated, state)
  const batches = planBatches(stale, english, translated, {
    maxChars: options.maxChars ?? DEFAULT_BATCH_LIMITS.maxChars,
    maxKeys: options.maxKeys ?? DEFAULT_BATCH_LIMITS.maxKeys
  })

  const failures: string[] = []
  let reviewed = 0
  let done = 0
  // Reported for every batch, however it ended. A progress line that only
  // appears on success reads as a stall when a run is failing every request,
  // which is the moment someone most needs to see it.
  const report = (keys: readonly string[], findings: number | null) => {
    done += 1
    options.onBatch?.({ done, total: batches.length, keys, findings })
  }

  await pooled(batches, options.concurrency ?? 2, async (keys) => {
    const label = `${keys[0]} +${keys.length - 1}`
    try {
      const findings = await reviewBatch(keys)
      if (findings === null) {
        failures.push(label)
        report(keys, null)
        return
      }
      // Every key in a batch that came back gets a verdict, including the ones
      // with nothing to report: "clean" is a verdict, and storing it is what
      // stops the next run paying to ask the same question again.
      for (const key of keys) {
        state.entries[key] = {
          hash: keyHash(english[key], translated[key]),
          findings: findings.filter((finding) => finding.key === key)
        }
        reviewed += 1
      }
      report(keys, findings.length)
    } catch (error) {
      // Narrowed rather than asserted: an SDK can reject with something that is
      // not an `Error`, and asserting one would put `undefined` where the reason
      // should be — on the line whose only job is to say why a batch failed.
      const why = error instanceof Error ? error.message : String(error)
      failures.push(`${label} (${why})`)
      report(keys, null)
    }
  })

  return { state, reviewed, failures }
}
