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
import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { LOCALIZED_CODES, localePrefix } from '../src/config/locales'
import { comparePage } from '../src/utils/pageCoverage'
import { preserveTerms } from './i18n/config'
import { localizedBuildPages } from './lib/built-pages'

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

function main(): void {
  if (!existsSync(DIST)) {
    process.stderr.write(
      '[localized-pages] dist/ is missing. Run `pnpm build` first.\n'
    )
    process.exit(1)
  }

  const preserved = preserveTerms()

  const pages = localizedBuildPages(DIST)
  const compared = pages.length
  const failures = pages.flatMap((page) => {
    const { tagRatio } = comparePage({ ...page, preserveTerms: preserved })
    return tagRatio < MINIMUM_TAG_RATIO
      ? [
          `/${page.prefix}/${page.route} renders ${Math.round(100 * tagRatio)}% of the ` +
            `elements /${page.route} does — a section is missing, not untranslated`
        ]
      : []
  })

  process.stdout.write(
    `[localized-pages] ${compared} localized pages compared against their ` +
      `English original.\n`
  )

  // Nothing compared is not a pass. A `dist/` built without the locale
  // directories — a partial build, a renamed prefix — skips every route and
  // reaches here with no failures to report, so the gate would wave through
  // exactly the state it exists to catch.
  if (compared === 0) {
    process.stderr.write(
      '[localized-pages] no localized page was compared. Expected pages under ' +
        `${LOCALIZED_CODES.map((code) => localePrefix(code)).join(', ')} in dist/. ` +
        'Run `pnpm build` first.\n'
    )
    process.exit(1)
  }

  if (failures.length > 0) {
    process.stderr.write(
      failures.map((failure) => `[localized-pages] ${failure}\n`).join('')
    )
    process.exit(1)
  }

  process.stdout.write(
    '[localized-pages] every one renders the content its English original does.\n'
  )
}

main()
