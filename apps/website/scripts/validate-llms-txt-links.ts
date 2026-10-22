import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

import { linkStaleSources } from '@/config/redirects'
import {
  findStaleLinks,
  isLinkedFile,
  isWorkflowsAppPath,
  sectionLlmsFiles
} from '@/lib/llms-txt'

const DIST_DIR = join(process.cwd(), 'dist')
const CANONICAL_LINK = /<link\b[^>]*\brel=["']canonical["'][^>]*>/i
const HREF_ATTRIBUTE = /\bhref=["']([^"']+)["']/i

/** `/download` -> `dist/download/index.html`, `/hub/models.md` -> `dist/hub/models.md`. */
function distFileFor(pathname: string): string {
  const trimmed = pathname.replace(/^\/|\/$/g, '')
  return isLinkedFile(trimmed)
    ? join(DIST_DIR, trimmed)
    : join(DIST_DIR, trimmed, 'index.html')
}

/** The built page's own `rel="canonical"` href, or undefined for a file or an unbuilt path. */
function canonicalFor(pathname: string): string | undefined {
  const file = distFileFor(pathname)
  if (!file.endsWith('.html') || !existsSync(file)) return undefined

  const html = readFileSync(file, 'utf8')
  const canonicalTag = CANONICAL_LINK.exec(html)?.[0]
  const canonical =
    canonicalTag === undefined
      ? undefined
      : HREF_ATTRIBUTE.exec(canonicalTag)?.[1]
  if (canonical === undefined) {
    throw new Error(`Built page ${file} has no canonical link.`)
  }
  return canonical
}

function isServed(pathname: string): boolean {
  return isWorkflowsAppPath(pathname) || existsSync(distFileFor(pathname))
}

/** `dist/llms-full.txt` plus every `llms.txt` the build wrote, root first. */
function builtLlmsFiles(): string[] {
  const sectionFiles = sectionLlmsFiles(
    readdirSync(DIST_DIR, { recursive: true }).map(String),
    sep
  )
  return ['llms.txt', 'llms-full.txt', ...sectionFiles].map((file) =>
    join(DIST_DIR, file)
  )
}

function main(): void {
  if (!existsSync(DIST_DIR)) {
    console.error(
      `llms.txt link validation failed: ${DIST_DIR} does not exist.`
    )
    process.exit(1)
  }

  const checks = { redirectSources: linkStaleSources, isServed, canonicalFor }
  const files = builtLlmsFiles()
  const failures = files.flatMap((file) =>
    findStaleLinks(readFileSync(file, 'utf8'), checks).map(
      (problem) => `  ${relative(process.cwd(), file)}: ${problem}`
    )
  )

  if (failures.length > 0) {
    console.error(
      `llms.txt link validation failed (${failures.length} stale link(s)):`
    )
    for (const failure of failures) console.error(failure)
    process.exit(1)
  }

  process.stdout.write(
    `llms.txt link validation passed for ${files.length} file(s).\n`
  )
}

main()
