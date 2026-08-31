import type { AstroIntegration } from 'astro'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { isExcludedFromSitemap } from '../config/indexing'
import { htmlToTwin, renderTwin } from '../lib/markdown-twin'
import { markdownTwinPath } from '../lib/markdown-twin-path'

export interface TwinReport {
  written: string[]
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
  const report: TwinReport = { written: [], skipped: [] }
  for (const pathname of pathnames) {
    const route = `/${pathname}`
    const twinPath = markdownTwinPath(route)
    const target = join(root, twinPath)
    const html = await readBuiltPage(root, pathname)
    if (
      !html ||
      isExcludedFromSitemap(new URL(route, site).href) ||
      (await exists(target))
    ) {
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

export function markdownTwins(): AstroIntegration {
  return {
    name: 'comfy:markdown-twins',
    hooks: {
      'astro:build:done': async ({ dir, pages, logger }) => {
        const report = await writeMarkdownTwins(
          fileURLToPath(dir),
          pages.map((page) => page.pathname)
        )
        logger.info(
          `wrote ${report.written.length} markdown twins, skipped ${report.skipped.length}`
        )
      }
    }
  }
}
