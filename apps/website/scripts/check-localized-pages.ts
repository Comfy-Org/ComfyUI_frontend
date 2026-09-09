/**
 * Crawls the built site and fails when a localized page is missing content its
 * English original has.
 *
 * Same shape as `check-hreflang.ts`: reads dist/ directly, costs one build and
 * no network. It exists because two pages shipped with a section silently gone
 * rather than merely untranslated — `/ja/pricing` rendered its FAQ heading with
 * all 21 questions absent, and `/ja/customers` listed no customers — both
 * because a content collection filtered by locale returned an empty array. A
 * reader cannot tell that copy was ever there, so it is worse than English copy
 * and worth failing a build over.
 *
 * The rules live in `src/utils/pageCoverage.ts` so they can be tested against
 * fixtures rather than a full build.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

import { LOCALIZED_CODES, localePrefix } from '../src/config/locales'
import { comparePage } from '../src/utils/pageCoverage'
import { preserveTerms } from './i18n/config'

const DIST = join(process.cwd(), 'dist')

/**
 * How much smaller a localized page may be before it counts as broken.
 *
 * Measured rather than guessed. Legitimate differences come from markup inside
 * a translated string — `<strong>` and `<a>` swapping order in Chinese on
 * `/pricing`, a `<span>` fewer on `/cloud` — and top out around 1%. The real
 * defect was a 27% shortfall. Ten percent sits in the gap with room either way.
 */
const MINIMUM_TAG_RATIO = 0.9

function localePrefixes(): string[] {
  return LOCALIZED_CODES.map((locale) =>
    localePrefix(locale).replace(/^\//, '')
  )
}

/** Every English route that was built, as a dist-relative directory. */
function englishRoutes(dir: string = DIST, acc: string[] = []): string[] {
  const skip = new Set(localePrefixes())
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

function main(): void {
  if (!existsSync(DIST)) {
    process.stderr.write(
      '[localized-pages] dist/ is missing. Run `pnpm build` first.\n'
    )
    process.exit(1)
  }

  const preserved = preserveTerms()

  const routes = englishRoutes()
  const failures: string[] = []
  let compared = 0

  for (const locale of LOCALIZED_CODES) {
    const prefix = localePrefix(locale).replace(/^\//, '')
    for (const route of routes) {
      const localizedFile = join(DIST, prefix, route, 'index.html')
      if (!existsSync(localizedFile)) continue

      compared++
      const { tagRatio } = comparePage({
        english: readFileSync(join(DIST, route, 'index.html'), 'utf8'),
        localized: readFileSync(localizedFile, 'utf8'),
        preserveTerms: preserved
      })
      if (tagRatio < MINIMUM_TAG_RATIO) {
        failures.push(
          `/${prefix}/${route} renders ${Math.round(100 * tagRatio)}% of the ` +
            `elements /${route} does — a section is missing, not untranslated`
        )
      }
    }
  }

  process.stdout.write(
    `[localized-pages] ${compared} localized pages compared against their ` +
      `English original.\n`
  )

  if (failures.length > 0) {
    for (const failure of failures) {
      process.stderr.write(`[localized-pages] ${failure}\n`)
    }
    process.exit(1)
  }

  process.stdout.write(
    '[localized-pages] every one renders the content its English original does.\n'
  )
}

main()
