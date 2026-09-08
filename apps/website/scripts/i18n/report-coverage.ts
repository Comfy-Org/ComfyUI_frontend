/**
 * report-coverage — what is actually translated, and therefore what is ready to
 * be flipped indexable.
 *
 * Run: `pnpm i18n:report` (no API key needed).
 *
 * Indexability is gated by an explicit page allowlist rather than computed at
 * render time, because a page's completeness is only known after it renders
 * while its hreflang tags are written before that, and the two disagreeing is
 * the exact defect Phase 0 fixed. So this does not decide anything: it tells a
 * human which namespaces are complete enough to add to the allowlist.
 *
 * Reported two ways, because neither alone answers the question.
 *
 * **By namespace** is what the pipeline works in and needs no build. It used to
 * be described as a close proxy for a page, and it is not one: the median page
 * reaches 14 namespaces, `/cli` reaches 25, and every page reaches `nav`,
 * `footer` and `cta`. So "pricing 100%" never meant `/ja/pricing` was ready.
 *
 * **By page** is what a reader gets, measured from the built site by comparing
 * each localized page against its English original. It needs no key mapping, so
 * unlike a scan of `t()` calls it also sees copy arriving through data files and
 * content collections — which is most of what was invisible before.
 *
 * Requires `pnpm build` first, and says so rather than failing when dist is
 * absent: the nightly translation workflow runs this before opening its PR and
 * never builds the site, so exiting non-zero here would stop that PR over
 * something unrelated to translation. Missing CONTENT is failed on by
 * `pnpm check:localized-pages`, which runs after the build in CI.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

import { LOCALIZED_CODES, localePrefix } from '../../src/config/locales'
import { comparePage } from '../../src/utils/pageCoverage'
import { translatableEntries } from '../../src/i18n/pipeline/source'
import { translationsAdapter } from '../../src/i18n/pipeline/adapters/translations'
import { resolveTranslation } from '../../src/i18n/source'
import type { TranslationKey } from '../../src/i18n/source'

interface Coverage {
  total: number
  approved: number
  machine: number
  english: number
}

function empty(): Coverage {
  return { total: 0, approved: 0, machine: 0, english: 0 }
}

function main(): void {
  const entries = translatableEntries(translationsAdapter.read())

  for (const locale of LOCALIZED_CODES) {
    const byNamespace = new Map<string, Coverage>()
    const overall = empty()

    for (const entry of entries) {
      const namespace = entry.key.split('.')[0]
      const coverage = byNamespace.get(namespace) ?? empty()
      const { provenance } = resolveTranslation(
        entry.key as TranslationKey,
        locale
      )
      coverage.total++
      overall.total++
      coverage[provenance]++
      overall[provenance]++
      byNamespace.set(namespace, coverage)
    }

    const done = overall.approved + overall.machine
    const pct = (n: number, of: number) =>
      of === 0 ? '  0%' : `${String(Math.round((100 * n) / of)).padStart(3)}%`

    process.stdout.write(
      `\n${locale}: ${pct(done, overall.total)} translated ` +
        `(${overall.approved} approved, ${overall.machine} machine, ` +
        `${overall.english} still English of ${overall.total})\n`
    )

    // Only the incomplete ones are worth a human's attention; a namespace at
    // 100% is ready to add to the allowlist and needs no discussion.
    const incomplete = [...byNamespace.entries()]
      .filter(([, c]) => c.english > 0)
      .sort((a, b) => b[1].english - a[1].english)

    if (incomplete.length === 0) {
      process.stdout.write('  every namespace is complete.\n')
      continue
    }
    process.stdout.write(
      `  ${byNamespace.size - incomplete.length} of ${byNamespace.size} ` +
        `namespaces complete. Still incomplete:\n`
    )
    for (const [namespace, c] of incomplete.slice(0, 15)) {
      process.stdout.write(
        `    ${pct(c.approved + c.machine, c.total)}  ${namespace.padEnd(22)} ` +
          `${c.english} of ${c.total} still English\n`
      )
    }
    if (incomplete.length > 15) {
      process.stdout.write(`    ... and ${incomplete.length - 15} more\n`)
    }
  }

  reportPages()
}

const DIST = join(process.cwd(), 'dist')

/** Every English route in the build, as a dist-relative directory. */
function englishRoutes(dir: string = DIST, acc: string[] = []): string[] {
  const skip = new Set(
    LOCALIZED_CODES.map((locale) => localePrefix(locale).replace(/^\//, ''))
  )
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (
        dir === DIST &&
        (skip.has(entry.name) || entry.name.startsWith('_'))
      ) {
        continue
      }
      englishRoutes(full, acc)
    } else if (entry.name === 'index.html') {
      acc.push(relative(DIST, dir).split(sep).join('/'))
    }
  }
  return acc
}

/**
 * Per-page coverage, scored against what is actually achievable on that page.
 *
 * An absolute threshold does not work here. Every page carries copy no locale
 * translates — brand names, people's names, the model catalogue, `Discord` —
 * so the best fully-translated page on the site reaches 91%, not 100%, and
 * judging against 95% reported a complete Chinese site as zero pages ready.
 *
 * The reference is therefore the best score any locale reaches on that same
 * page. It self-calibrates: whatever residue a page carries, every locale
 * carries it equally, so a locale matching the reference is as translated as
 * that page can be. No locale is named, so this keeps working if the set
 * changes.
 */
function reportPages(): void {
  if (!existsSync(DIST)) {
    process.stdout.write(
      '\nPer-page coverage needs a build. Run `pnpm build`, then this again.\n'
    )
    return
  }

  const preserveTerms = JSON.parse(
    readFileSync(
      join(process.cwd(), 'src', 'i18n', 'glossary', 'preserve-terms.json'),
      'utf8'
    )
  ) as string[]

  const routes = englishRoutes()
  const scores = new Map<string, Map<string, number>>()

  for (const locale of LOCALIZED_CODES) {
    const prefix = localePrefix(locale).replace(/^\//, '')
    for (const route of routes) {
      const localized = join(DIST, prefix, route, 'index.html')
      if (!existsSync(localized)) continue
      const { translated, total } = comparePage({
        english: readFileSync(join(DIST, route, 'index.html'), 'utf8'),
        localized: readFileSync(localized, 'utf8'),
        preserveTerms
      })
      if (total === 0) continue
      const byLocale = scores.get(route) ?? new Map<string, number>()
      byLocale.set(locale, translated)
      scores.set(route, byLocale)
    }
  }

  const best = (route: string) =>
    Math.max(...(scores.get(route)?.values() ?? [0]))

  const pct = (n: number) => `${String(Math.round(100 * n)).padStart(3)}%`

  for (const locale of LOCALIZED_CODES) {
    const rows = [...scores.entries()]
      .filter(([, byLocale]) => byLocale.has(locale))
      .map(([route, byLocale]) => ({
        route: `/${route}`,
        score: byLocale.get(locale) as number,
        reference: best(route)
      }))
    if (rows.length === 0) continue

    // Within three points of the best any locale manages on that page.
    const ready = rows.filter((row) => row.score >= row.reference - 0.03)
    rows.sort((a, b) => a.score - b.score)

    process.stdout.write(
      `\n${locale}: ${ready.length} of ${rows.length} built pages are as ` +
        `translated as that page gets.\n`
    )
    process.stdout.write('  furthest from ready (page, this locale, best):\n')
    for (const row of rows.slice(0, 10)) {
      process.stdout.write(
        `    ${pct(row.score)} vs ${pct(row.reference)}  ${row.route}\n`
      )
    }
  }
}

main()
