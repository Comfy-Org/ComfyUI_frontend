import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { findCanonicalDrift, parseLlmsTxtLinks } from '../src/lib/llms-txt'

const DIST_DIR = join(process.cwd(), 'dist')
const CANONICAL_LINK = /<link\b[^>]*\brel=["']canonical["'][^>]*>/i
const HREF_ATTRIBUTE = /\bhref=["']([^"']+)["']/i

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

  const canonicalTag = CANONICAL_LINK.exec(html)?.[0]
  const canonical =
    canonicalTag === undefined
      ? undefined
      : HREF_ATTRIBUTE.exec(canonicalTag)?.[1]
  if (canonical === undefined) {
    throw new Error(
      `Built page ${distFileFor(pathname)} has no canonical link.`
    )
  }
  return canonical
}

function main(): void {
  if (!existsSync(DIST_DIR)) {
    console.error(
      `llms.txt link validation failed: ${DIST_DIR} does not exist.`
    )
    process.exit(1)
  }

  const llmsTxt = readFileSync(
    join(process.cwd(), 'public', 'llms.txt'),
    'utf8'
  )
  const links = parseLlmsTxtLinks(llmsTxt)
  const { drift, checked } = findCanonicalDrift(links, canonicalFor)

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

  if (checked === 0) {
    console.error(
      `llms.txt link validation failed: 0 of ${links.length} link(s) were checked against a built canonical.`
    )
    process.exit(1)
  }

  process.stdout.write(
    `llms.txt link validation passed for ${checked}/${links.length} link(s).\n`
  )
}

main()
