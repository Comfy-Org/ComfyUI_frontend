import type { AstroIntegration } from 'astro'
import { access, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

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
  const trimmed = pathname.replace(/\/$/, '')
  const candidates = [
    join(root, trimmed, 'index.html'),
    join(root, `${trimmed || 'index'}.html`)
  ]
  for (const candidate of candidates) {
    if (await exists(candidate)) return readFile(candidate, 'utf8')
  }
  return undefined
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

    const html = await readBuiltPage(root, pathname)
    if (!html) {
      report.skipped.push(twinPath)
      continue
    }
    // A redirect stub is a meta-refresh, not content. Astro's own page list
    // left these out; reading the built site off disk finds them, so they are
    // filtered on what the page IS rather than on a config listing them.
    if (html.includes('http-equiv="refresh"')) {
      report.skipped.push(twinPath)
      continue
    }
    const page = htmlToTwin(html, new URL(route, site).href)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, renderTwin(page), 'utf8')
    report.written.push(twinPath)
  }
  return report
}

/** Every built page, as Astro would have named it: `about/`, `zh-CN/pricing/`. */
async function builtPages(root: string): Promise<string[]> {
  const found: string[] = []

  async function walk(dir: string, prefix: string): Promise<void> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        await walk(join(dir, entry.name), `${prefix}${entry.name}/`)
      } else if (entry.name === 'index.html') {
        found.push(prefix)
      }
    }
  }

  await walk(root, '')
  return found.sort()
}

export function markdownTwins(): AstroIntegration {
  return {
    name: 'comfy:markdown-twins',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const root = fileURLToPath(dir)
        // Read the pages off DISK rather than from Astro's `pages` list.
        //
        // That list omits routes produced by the i18n fallback, which is every
        // localized page once a locale is served from the English file. It cost
        // Japanese all 560 of its twins without a word, and deleting the Chinese
        // page files would have taken all 144 Chinese twins with them and shrunk
        // llms-full.txt to match.
        //
        // `isExcludedFromSitemap` still decides what deserves a twin, so a
        // held-back locale gains none: Japanese pages are built but unpublished,
        // and a twin of an English page at a /ja/ URL is not content.
        const report = await writeMarkdownTwins(root, await builtPages(root))
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
