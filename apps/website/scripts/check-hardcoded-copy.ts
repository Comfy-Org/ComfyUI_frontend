/**
 * Fails the build when a page carries copy the translation pipeline cannot see.
 *
 * Run: `pnpm check:hardcoded-copy` (no build required — it reads source).
 *
 * A string typed into a page file has no key, so it reaches no adapter and
 * appears in no report or coverage number. It renders English in every locale
 * and nothing says so. `/zh-CN/enterprise` shipped an English FAQ this way, on
 * a locale that is otherwise complete.
 *
 * Scoped by exemption rather than by threshold. Two pages are English on
 * purpose, and they are named here so that adding a third is a decision
 * somebody makes in a diff rather than a number quietly drifting.
 *
 * The rules live in `src/utils/hardcodedCopy.ts` so they can be tested against
 * fixtures rather than against whatever the site happens to contain today.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

import { hardcodedProse } from '../src/utils/hardcodedCopy'

const SRC = join(process.cwd(), 'src')

/**
 * Pages nobody asked to have translated. The same two that
 * `PAGES_OPTED_OUT` names in the pipeline, for the same reason: a one-off
 * launch page, and a page whose own description calls itself temporary.
 */
const EXEMPT = [
  'pages/pixal3d-trellis2.astro',
  'pages/platform/serverless-animation.astro'
]

function astroFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) astroFiles(full, found)
    else if (entry.endsWith('.astro')) found.push(full)
  }
  return found
}

function main(): void {
  const offenders: { file: string; phrases: string[] }[] = []

  for (const file of astroFiles(SRC).sort()) {
    const name = relative(SRC, file)
    if (EXEMPT.includes(name)) continue

    const phrases = hardcodedProse(readFileSync(file, 'utf8'))
    if (phrases.length > 0) offenders.push({ file: name, phrases })
  }

  if (offenders.length === 0) {
    process.stdout.write(
      '[hardcoded-copy] no page carries copy the pipeline cannot see.\n'
    )
    return
  }

  const total = offenders.reduce((n, entry) => n + entry.phrases.length, 0)
  for (const { file, phrases } of offenders) {
    process.stderr.write(`[hardcoded-copy] ${file}\n`)
    for (const phrase of phrases.slice(0, 4)) {
      process.stderr.write(`    ${phrase.slice(0, 96)}\n`)
    }
    if (phrases.length > 4) {
      process.stderr.write(`    ...and ${phrases.length - 4} more\n`)
    }
  }
  process.stderr.write(
    `\n[hardcoded-copy] ${total} phrase(s) in ${offenders.length} file(s) have no ` +
      'translation key, so they render English in every locale.\n' +
      '[hardcoded-copy] Move them into src/i18n/source.ts and read them with t().\n'
  )
  process.exit(1)
}

main()
