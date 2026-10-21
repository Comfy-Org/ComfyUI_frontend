/**
 * Fails when too few built pages advertise a markdown copy, or a page
 * advertises one that was not built or whose front matter does not name that
 * page as its canonical.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  advertisementShortfall,
  auditMarkdownAlternates
} from '@/utils/markdownAlternateAudit'

import { htmlFiles, isFileWithExactCase, routeOf } from './dist-html'

const DIST = join(process.cwd(), 'dist')
const ORIGIN = 'https://comfy.org'

function readTwin(path: string): string | undefined {
  return isFileWithExactCase(DIST, path)
    ? readFileSync(join(DIST, path), 'utf-8')
    : undefined
}

if (!existsSync(DIST)) {
  console.error(`[markdown-alternates] ${DIST} does not exist; build first.`)
  process.exit(1)
}

const pages = htmlFiles(DIST).map((file) => ({
  route: routeOf(DIST, file),
  html: readFileSync(file, 'utf-8')
}))
const { advertised, canonicalChecked, problems } = auditMarkdownAlternates(
  pages,
  readTwin,
  ORIGIN
)

const shortfall = advertisementShortfall(advertised, pages.length)
if (shortfall !== undefined) {
  console.error(`[markdown-alternates] ${shortfall}`)
  process.exit(1)
}

if (problems.length > 0) {
  console.error(
    `[markdown-alternates] ${problems.length} of ${advertised} advertised markdown copies are broken:`
  )
  for (const problem of problems) console.error(`  ${problem}`)
  process.exit(1)
}

console.warn(
  `[markdown-alternates] ${advertised} of ${pages.length} pages advertise a markdown copy, and every copy exists. ` +
    `${canonicalChecked} name their page as canonical; ${advertised - canonicalChecked} pages emit no canonical to compare.`
)
