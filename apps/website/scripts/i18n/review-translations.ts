/**
 * review-translations — the judgement layer for the marketing pipeline.
 *
 * Run: `WEBSITE_I18N_LOCALE=ja pnpm i18n:review` (needs ANTHROPIC_API_KEY).
 *
 * Reads  src/i18n/content/{locale}.json   what is published
 *        src/i18n/incoming/{locale}.json  what this run is about to publish
 * Writes src/i18n/review/{locale}.json    a verdict per key, committed
 *
 * It reads BOTH layers because the question is "is what we are about to publish
 * good", and reviewing only `content` would leave tonight's new translations
 * live for a day before anyone looked at them. The staged half is put through
 * the deterministic gate first, so what the reviewer judges is exactly the layer
 * enforce is about to write — no more, no less.
 *
 * This file writes verdicts and nothing else. Pruning stays in
 * `enforce-translations`, which reads the verdicts and drops the keys with a
 * critical or major finding through the same path as a lost brand name. So a
 * rejected translation renders English, and the reviewer adds no second gate.
 *
 * The rules live in `src/i18n/pipeline/review.ts` and are tested without this
 * file, the SDK, or a key. The SDK is imported dynamically below for that
 * reason: the pure logic must not depend on the dependency being installed.
 */
import fs from 'node:fs'
import path from 'node:path'

import { isLocale } from '../../src/config/locales'
import { readTranslationLayer } from '../../src/i18n/pipeline/artifacts'
import { enforceTranslations } from '../../src/i18n/pipeline/enforce'
import {
  DEFAULT_BATCH_LIMITS,
  buildSystemPrompt,
  buildUserPrompt,
  FINDINGS_SCHEMA,
  glossaryFingerprint,
  loadReviewState,
  parseFindings,
  parsePositiveInt,
  pruneOrphanedVerdicts,
  resolveReviewModel,
  reviewAll,
  selectKeysForReview,
  serializeReviewState,
  summarize
} from '../../src/i18n/pipeline/review'
import type { ReviewState } from '../../src/i18n/pipeline/review'
import type {
  EnglishSource,
  TranslationLayer
} from '../../src/i18n/pipeline/types'
import { collectViolations } from '../../src/i18n/pipeline/validate'
import { localeRubric, OUTPUT_LOCALES, preserveTerms } from './config'

const I18N_DIR = path.join(process.cwd(), 'src', 'i18n')
const REVIEW_DIR = path.join(I18N_DIR, 'review')

/**
 * Ceiling so a runaway loop fails loudly instead of quietly running up a bill.
 *
 * Set above the whole corpus (~2,500 keys), because the first run legitimately
 * reviews all of it: nothing has a verdict yet. Every run after that asks only
 * about what changed, so a run anywhere near this number again means the rubric
 * moved or the state file was lost, and both deserve a deliberate decision
 * rather than a silent charge.
 */
const MAX_KEYS_PER_RUN = parsePositiveInt(
  process.env.WEBSITE_I18N_REVIEW_MAX_KEYS,
  3000,
  'WEBSITE_I18N_REVIEW_MAX_KEYS'
)

/** Matches the translator's `requestConcurrency`, so both stay under one limit. */
const CONCURRENCY = parsePositiveInt(
  process.env.WEBSITE_I18N_REVIEW_CONCURRENCY,
  2,
  'WEBSITE_I18N_REVIEW_CONCURRENCY'
)

const MODEL = resolveReviewModel(process.env.WEBSITE_I18N_REVIEW_MODEL)

/**
 * The stored verdicts, which `loadReviewState` validates in full.
 *
 * Absence is normal on the first run for a locale. A malformed file is not
 * silently discarded here either: `loadReviewState` drops entries it cannot
 * read, so a damaged file costs the cache rather than corrupting a verdict.
 */
function readReviewState(file: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

function writeState(locale: string, state: ReviewState): void {
  fs.mkdirSync(REVIEW_DIR, { recursive: true })
  fs.writeFileSync(
    path.join(REVIEW_DIR, `${locale}.json`),
    `${JSON.stringify(serializeReviewState(state), null, 2)}\n`,
    'utf8'
  )
}

async function main(): Promise<void> {
  const locale = process.env.WEBSITE_I18N_LOCALE
  const output = isLocale(locale) ? OUTPUT_LOCALES[locale] : undefined
  if (!isLocale(locale) || !output) {
    console.error(
      `[i18n] set WEBSITE_I18N_LOCALE to one of: ${Object.keys(OUTPUT_LOCALES).join(', ')}`
    )
    process.exit(1)
  }

  const english: EnglishSource = readTranslationLayer(
    path.join(I18N_DIR, 'content', 'en.json')
  )
  if (Object.keys(english).length === 0) {
    console.error(
      '[i18n] review: no English content-of-record. Run `pnpm i18n:build-source` first.'
    )
    process.exit(1)
  }

  const terms = preserveTerms()
  const voice = localeRubric(locale)

  // Exactly the layer enforce is about to write: what is published, overlaid
  // with the staged translations that pass the deterministic gate.
  //
  // The overlay is the point — a key translated tonight is judged tonight,
  // rather than going live unreviewed until tomorrow's run. Applying the gate
  // first matters too: a staged translation that has already lost a brand name
  // is going to be dropped whatever the reviewer says, so paying to judge it
  // wastes a call, and storing a verdict for text that never publishes would
  // shadow the published translation it never replaced.
  const incoming = readTranslationLayer(
    path.join(I18N_DIR, 'incoming', `${locale}.json`)
  )
  const { kept } = enforceTranslations(
    incoming,
    collectViolations(english, incoming, locale, terms)
  )
  const translated: TranslationLayer = {
    ...readTranslationLayer(path.join(I18N_DIR, 'content', `${locale}.json`)),
    ...kept
  }
  if (Object.keys(translated).length === 0) {
    process.stdout.write(`[i18n] review: ${locale} has nothing to review.\n`)
    return
  }

  const rubric = glossaryFingerprint(terms, voice.guidance)
  const statePath = path.join(REVIEW_DIR, `${locale}.json`)
  const priorState = loadReviewState(readReviewState(statePath), rubric)

  const pending = selectKeysForReview(
    english,
    translated,
    pruneOrphanedVerdicts(priorState, translated)
  ).length
  if (pending === 0) {
    process.stdout.write(
      `[i18n] review: ${locale} up to date (${Object.keys(priorState.entries).length} key(s)).\n`
    )
    return
  }

  // An ADDITIONAL gate on top of the deterministic floor, never a dependency of
  // it. With no key configured, skip cleanly rather than failing the run: the
  // pipeline then behaves exactly as it did before this step existed, which is
  // what lets it ship before the org secret is provisioned.
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn(
      '[i18n] review: ANTHROPIC_API_KEY is not set — skipping AI review. ' +
        'The deterministic checks still apply.'
    )
    return
  }

  if (pending > MAX_KEYS_PER_RUN) {
    console.error(
      `[i18n] review: ${locale} would review ${pending} key(s), over the ` +
        `${MAX_KEYS_PER_RUN} ceiling. Raise WEBSITE_I18N_REVIEW_MAX_KEYS ` +
        `deliberately if that is expected.`
    )
    process.exit(1)
  }

  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic()
  const system = buildSystemPrompt({
    locale,
    localeName: voice.name,
    guidance: voice.guidance,
    preserveTerms: terms
  })

  process.stdout.write(
    `[i18n] review: ${locale} reviewing ${pending} key(s) with ${MODEL}…\n`
  )

  // What the run actually cost, so nobody has to guess from the bill which step
  // spent it. Cached reads are counted separately because they are the whole
  // reason the rubric is sent as a cache breakpoint.
  const spend = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }

  const { state, reviewed, failures } = await reviewAll(
    english,
    translated,
    priorState,
    async (keys) => {
      // Streamed, and awaited whole. Not for progress output: the SDK refuses a
      // non-streaming request whose `max_tokens` implies it could run past ten
      // minutes, which is any budget over ~21k. Trimming the budget to satisfy
      // that heuristic would trade the thing that matters (room to answer) for
      // the thing that does not (which transport carries it).
      const response = await client.messages
        .stream({
          model: MODEL,
          // Thinking is on by default and its tokens come out of this budget, so
          // it covers the reasoning AND the findings. Sized well clear of both:
          // starving the budget truncates the answers with the most to say,
          // which means the worst translations are the ones that fail to
          // review. Unused budget is not billed.
          max_tokens: 32000,
          // Cached: the rubric is identical for every request in this locale,
          // so the rest of the run reads it back at a fraction of the price.
          system: [
            { type: 'text', text: system, cache_control: { type: 'ephemeral' } }
          ],
          output_config: {
            effort: 'high',
            format: { type: 'json_schema', schema: FINDINGS_SCHEMA }
          },
          messages: [
            {
              role: 'user',
              content: buildUserPrompt(keys, english, translated)
            }
          ]
        })
        .finalMessage()

      spend.input += response.usage.input_tokens
      spend.output += response.usage.output_tokens
      spend.cacheRead += response.usage.cache_read_input_tokens ?? 0
      spend.cacheWrite += response.usage.cache_creation_input_tokens ?? 0

      // A refusal or a truncated answer is not a verdict, so return null and let
      // the batch stay unreviewed rather than be recorded as clean. Logged with
      // the reason: a silent null is indistinguishable from a network blip, and
      // the two need opposite responses — retry versus raise the budget.
      const incomplete = [
        'refusal',
        'max_tokens',
        'model_context_window_exceeded'
      ]
      if (incomplete.includes(response.stop_reason ?? '')) {
        console.warn(
          `[i18n] review: ${keys[0]} +${keys.length - 1} unreviewed ` +
            `(stop_reason=${response.stop_reason})`
        )
        return null
      }
      const block = response.content.find((part) => part.type === 'text')
      if (!block) {
        console.warn(
          `[i18n] review: ${keys[0]} +${keys.length - 1} unreviewed (no text block)`
        )
        return null
      }
      return parseFindings(JSON.parse(block.text), keys)
    },
    {
      concurrency: CONCURRENCY,
      ...DEFAULT_BATCH_LIMITS,
      onBatch: ({ done, total, keys, findings }) => {
        process.stdout.write(
          `[i18n] review: ${locale} [${done}/${total}] ${keys[0]} +${keys.length - 1} ` +
            `→ ${findings === null ? 'unreviewed' : `${findings} finding(s)`}\n`
        )
      }
    }
  )

  writeState(locale, state)

  const counted = summarize(state)
  process.stdout.write(
    `[i18n] review: ${locale} reviewed ${reviewed} key(s); ` +
      `${counted.findings} finding(s) across ${counted.keys} key(s) on record ` +
      `(${counted.bySeverity.critical} critical, ${counted.bySeverity.major} major, ` +
      `${counted.bySeverity.minor} minor).\n`
  )
  const thousands = (n: number) => `${Math.round(n / 1000)}k`
  process.stdout.write(
    `[i18n] review: ${locale} spent ${thousands(spend.input)} input, ` +
      `${thousands(spend.output)} output, ${thousands(spend.cacheRead)} cached ` +
      `read, ${thousands(spend.cacheWrite)} cached write.\n`
  )
  if (failures.length > 0) {
    // Unreviewed batches keep whatever verdict they had and are picked up next
    // run, so a transient API failure delays review rather than faking it.
    console.warn(
      `[i18n] review: ${locale} ${failures.length} batch(es) could not be ` +
        `reviewed: ${failures.slice(0, 10).join(', ')}`
    )
  }
}

main().catch((error: unknown) => {
  console.error('[i18n] review: fatal —', error)
  process.exit(1)
})
