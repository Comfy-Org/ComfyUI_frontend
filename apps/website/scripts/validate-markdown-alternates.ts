/**
 * Fails when a built page advertises a markdown copy that was not built, or
 * whose front matter does not name that page as its canonical.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

import { auditMarkdownAlternates } from '@/utils/markdownAlternateAudit'

const DIST = join(process.cwd(), 'dist')
const ORIGIN = 'https://comfy.org'

function htmlFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return htmlFiles(full)
    return entry.name.endsWith('.html') ? [full] : []
  })
}

/** `dist/zh-CN/about/index.html` -> `/zh-CN/about/` */
function routeOf(file: string): string {
  const rel = relative(DIST, file).split(sep).join('/')
  return `/${rel.replace(/index\.html$/, '')}`
}

function readTwin(path: string): string | undefined {
  const file = join(DIST, path)
  return existsSync(file) ? readFileSync(file, 'utf-8') : undefined
}

if (!existsSync(DIST)) {
  console.error(`[markdown-alternates] ${DIST} does not exist; build first.`)
  process.exit(1)
}

const pages = htmlFiles(DIST).map((file) => ({
  route: routeOf(file),
  html: readFileSync(file, 'utf-8')
}))
const { advertised, problems } = auditMarkdownAlternates(
  pages,
  readTwin,
  ORIGIN
)

if (advertised === 0) {
  console.error(
    `[markdown-alternates] none of ${pages.length} pages advertises a markdown copy; the check found nothing to verify.`
  )
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
  `[markdown-alternates] all ${advertised} advertised markdown copies exist and name their page as canonical.`
)
