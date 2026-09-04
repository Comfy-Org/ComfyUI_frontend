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
 * Keys are namespaced by page (`pricing.*`, `cli.*`), so per-namespace coverage
 * is a close proxy for per-page readiness without needing to render anything.
 */
import { LOCALIZED_CODES } from '../../src/config/locales'
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
}

main()
