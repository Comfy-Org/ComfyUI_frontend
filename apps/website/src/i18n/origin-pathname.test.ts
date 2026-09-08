import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const srcDir = dirname(dirname(fileURLToPath(import.meta.url)))

function astroFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) astroFiles(full, acc)
    else if (entry.endsWith('.astro')) acc.push(full)
  }
  return acc
}

/** Comments describe the trap; only real code can fall into it. */
function withoutComments(source: string): string {
  return (
    source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/[^\n]*$/gm, '')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      // .astro also allows plain HTML comments, and the trap below is worth
      // describing in one. Without this, documenting it would fail the guard.
      .replace(/<!--[\s\S]*?-->/g, '')
  )
}

/**
 * `Astro.url.pathname` is the WRONG path once a locale is served by the i18n
 * fallback.
 *
 * Astro rewrites the request, so during a fallback render it reports the
 * ENGLISH path while `Astro.currentLocale` is the locale actually asked for.
 * Anything deciding something locale-dependent from it is therefore wrong on
 * every localized page, and silently right on every English one — which is what
 * makes it so hard to spot.
 *
 * It got past P3-9, which swept `src/pages` and did not look in components,
 * templates or layouts. Two real defects followed: the JSON-LD on tutorial and
 * event pages built its VideoObject ids from the English URL while the page's
 * own WebPage node used the localized one, so the graph referenced a node that
 * was not there and `validate:jsonld` failed; and the announcement banner,
 * which hides itself when you are already on the page it links to, compared a
 * localized href against the English path and so refused to hide on
 * `/zh-CN/mcp`.
 *
 * `Astro.originPathname` is the pre-rewrite URL and is what every one of these
 * wants.
 */
describe('no page reads the pre-rewrite pathname', () => {
  const files = astroFiles(srcDir).map((file) => ({
    name: relative(srcDir, file),
    body: withoutComments(readFileSync(file, 'utf8'))
  }))

  it('finds .astro files to check', () => {
    expect(files.length).toBeGreaterThan(40)
  })

  it('never uses Astro.url.pathname', () => {
    const offenders = files
      .filter(({ body }) => body.includes('Astro.url.pathname'))
      .map(({ name }) => name)

    expect(
      offenders,
      'use Astro.originPathname: Astro.url.pathname is the English path during a fallback render'
    ).toEqual([])
  })
})
