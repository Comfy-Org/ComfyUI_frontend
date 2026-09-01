import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { findCanonicalDrift, parseLlmsTxtLinks } from '../src/lib/llms-txt'

const DIST_DIR = join(process.cwd(), 'dist')
const CANONICAL_LINK =
  /<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i

/** `/download/` -> `dist/download/index.html`, `/` -> `dist/index.html`. */
function distFileFor(pathname: string): string {
  const trimmed = pathname.replace(/^\/|\/$/g, '')
  return join(DIST_DIR, trimmed, 'index.html')
}

/** The built page's own `rel="canonical"` href, or undefined if it wasn't built. */
function canonicalFor(pathname: string): string | undefined {
  let html: string
  try {
    html = readFileSync(distFileFor(pathname), 'utf8')
  } catch {
    return undefined
  }
  return CANONICAL_LINK.exec(html)?.[1]
}

function main(): void {
  const llmsTxt = readFileSync(
    join(process.cwd(), 'public', 'llms.txt'),
    'utf8'
  )
  const links = parseLlmsTxtLinks(llmsTxt)
  const drift = findCanonicalDrift(links, canonicalFor)

  if (drift.length > 0) {
    console.error(
      `llms.txt link validation failed (${drift.length} stale link(s)):`
    )
    for (const { link, canonical } of drift) {
      console.error(
        `  [${link.title}](${link.url}) now canonicalizes to ${canonical}`
      )
    }
    process.exit(1)
  }

  process.stdout.write(
    `llms.txt link validation passed for ${links.length} link(s).\n`
  )
}

main()
