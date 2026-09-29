/**
 * Fails when a built page links to one of our pages without the trailing
 * slash. Both forms return 200, so a slashless link splits a page's signals
 * across two addresses until a crawler settles on the canonical one.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

import { slashlessPageHrefs } from '../src/utils/internalLinkSlashes'

const DIST = join(process.cwd(), 'dist')
const ORIGINS = ['https://comfy.org', 'https://www.comfy.org']

function htmlFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return htmlFiles(full)
    return entry.name.endsWith('.html') ? [full] : []
  })
}

if (!existsSync(DIST)) {
  console.error(`[link-slashes] ${DIST} does not exist; build first.`)
  process.exit(1)
}

const files = htmlFiles(DIST)
if (files.length === 0) {
  console.error(`[link-slashes] ${DIST} has no HTML pages to check.`)
  process.exit(1)
}
const pagesByHref = new Map<string, string[]>()
for (const file of files) {
  const page = `/${relative(DIST, file).split(sep).join('/')}`
  for (const href of slashlessPageHrefs(readFileSync(file, 'utf-8'), ORIGINS))
    pagesByHref.set(href, [...(pagesByHref.get(href) ?? []), page])
}

if (pagesByHref.size > 0) {
  const offenders = [...pagesByHref].sort(([, a], [, b]) => b.length - a.length)
  const links = offenders.reduce((sum, [, pages]) => sum + pages.length, 0)
  console.error(
    `[link-slashes] ${pagesByHref.size} internal page href(s) lack a trailing ` +
      `slash (${links} links across ${files.length} pages):`
  )
  for (const [href, pages] of offenders)
    console.error(
      `  ${href}  (${pages.length} page(s), e.g. ${pages.slice(0, 2).join(', ')})`
    )
  process.exit(1)
}

console.warn(
  `[link-slashes] every internal page link in ${files.length} pages ends with a slash.`
)
