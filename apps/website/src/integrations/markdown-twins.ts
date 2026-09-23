import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { AstroIntegration } from 'astro'

import { isExcludedFromSitemap } from '../config/indexing'
import { htmlToTwin, renderTwin } from '../lib/markdown-twin'
import { markdownTwinPath } from '../lib/markdown-twin-path'
import { writeFullText, writeSectionIndexes } from '../lib/section-index'
import type { SectionSpec } from '../lib/section-index'

/** Sections that get their own llms.txt, the Vercel and Cloudflare pattern. */
const SECTIONS: SectionSpec[] = [
  {
    prefix: '/learning',
    title: 'Learning',
    summary:
      'Hands-on ComfyUI tutorials by discipline: basics, ad creative, animation, and VFX.'
  },
  {
    prefix: '/customers',
    title: 'Customers',
    summary:
      'How studios, brands, artists, and universities use ComfyUI in production.'
  },
  {
    prefix: '/events',
    title: 'Events',
    summary:
      'Livestreams, hackathons, and community meetups, upcoming and recorded.'
  },
  {
    prefix: '/cloud/supported-nodes',
    title: 'Supported nodes on Comfy Cloud',
    summary: 'Custom-node packs preinstalled on Comfy Cloud, one page per pack.'
  }
]

const ALTERNATE_TWIN_SOURCES = new Map([['models', 'models/showcase']])

export interface TwinReport {
  written: string[]
  /** A twin already existed at this path (hand-written by a page endpoint). */
  existing: string[]
  /** No HTML to twin, or the page is deliberately excluded from the sitemap. */
  skipped: string[]
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function readBuiltPage(
  root: string,
  pathname: string
): Promise<string | undefined> {
  const trimmed = pathname.replace(/^\/+|\/+$/g, '')
  const candidates = [
    join(root, trimmed, 'index.html'),
    join(root, `${trimmed || 'index'}.html`)
  ]
  for (const candidate of candidates) {
    if (await exists(candidate)) return readFile(candidate, 'utf8')
  }
  return undefined
}

async function readBuiltTwinSource(
  root: string,
  pathname: string
): Promise<{ html: string; alternate: boolean } | undefined> {
  const alternatePathname = ALTERNATE_TWIN_SOURCES.get(
    pathname.replace(/^\/+|\/+$/g, '')
  )
  if (alternatePathname) {
    const html = await readBuiltPage(root, alternatePathname)
    if (html !== undefined) return { html, alternate: true }
  }

  const html = await readBuiltPage(root, pathname)
  return html === undefined ? undefined : { html, alternate: false }
}

/**
 * Write a `.md` twin next to every built HTML page: `/cli/` → `/cli.md`,
 * `/` → `/index.md`. Pages kept out of the sitemap get no twin, and a twin
 * that already exists (hand-written by a page endpoint) is left alone.
 */
export async function writeMarkdownTwins(
  root: string,
  pathnames: string[],
  site = 'https://comfy.org'
): Promise<TwinReport> {
  const report: TwinReport = { written: [], existing: [], skipped: [] }
  for (const pathname of pathnames) {
    const route = `/${pathname}`
    const twinPath = markdownTwinPath(route)
    const target = join(root, twinPath)

    if (isExcludedFromSitemap(new URL(route, site).href)) {
      report.skipped.push(twinPath)
      continue
    }
    if (await exists(target)) {
      // A page endpoint (e.g. supported-models' [slug].md.ts) already wrote
      // this twin. It is a real, current twin — section indexes and
      // llms-full.txt must still include it, just not regenerate it here.
      // Checked ahead of readBuiltPage: a page can ship a markdown twin with
      // no HTML counterpart at all, and that twin is still real content.
      report.existing.push(twinPath)
      continue
    }

    const source = await readBuiltTwinSource(root, pathname)
    if (!source) {
      report.skipped.push(twinPath)
      continue
    }
    const canonical = new URL(route, site).href
    const page = htmlToTwin(source.html, canonical, {
      canonical: source.alternate ? canonical : undefined
    })
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, renderTwin(page), 'utf8')
    report.written.push(twinPath)
  }
  return report
}

export function markdownTwins(): AstroIntegration {
  return {
    name: 'comfy:markdown-twins',
    hooks: {
      'astro:build:done': async ({ dir, pages, logger }) => {
        const root = fileURLToPath(dir)
        const report = await writeMarkdownTwins(
          root,
          pages.map((page) => page.pathname)
        )
        // Section indexes and llms-full.txt need every twin that actually
        // exists on disk, not just the ones this build freshly wrote — a
        // twin a page endpoint already wrote (report.existing) is just as
        // real and must not silently drop out of coverage.
        const availableTwins = [...report.written, ...report.existing]
        const indexes = await writeSectionIndexes(
          root,
          availableTwins,
          SECTIONS
        )
        const fullText = await writeFullText(root, availableTwins)
        logger.info(
          `wrote ${report.written.length} markdown twins, skipped ${report.skipped.length}, ${indexes.length} section indexes, and ${fullText}`
        )
      }
    }
  }
}
