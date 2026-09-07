import type { AstroIntegration } from 'astro'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { isExcludedFromSitemap } from '../config/indexing'
import { sitemapAlternates } from '../lib/hreflang'

/**
 * Puts back the localized pages `@astrojs/sitemap` cannot see.
 *
 * That integration builds from Astro's page list, which omits routes the i18n
 * fallback produces for DYNAMIC routes. Deleting the Chinese page files took the
 * Chinese sitemap from 146 URLs to 32 — every `/zh-CN/customers/*`,
 * `/zh-CN/learning/*` and `/zh-CN/cloud/supported-nodes/*` disappeared, while
 * the pages went on advertising a cluster nothing backed.
 *
 * Reads the built site rather than any route list, for the same reason the
 * markdown twins do: after a fallback, the filesystem is the only place that
 * knows what was really produced.
 */
export function missingSitemapEntries(
  builtPaths: string[],
  existingLocs: ReadonlySet<string>,
  origin: string,
  redirectStubs: ReadonlySet<string> = new Set()
): string[] {
  const entries: string[] = []

  for (const path of builtPaths) {
    const url = `${origin}${path}`
    if (existingLocs.has(url)) continue
    if (isExcludedFromSitemap(url)) continue
    // A redirect stub is a meta-refresh, not a page. Listing one advertises a
    // cluster the stub itself does not carry, which `check:hreflang` rejects.
    if (redirectStubs.has(path)) continue

    const links = sitemapAlternates(url) ?? []
    const alternates = links
      .map(
        (link) =>
          `<xhtml:link rel="alternate" hreflang="${link.lang}" href="${link.url}"/>`
      )
      .join('')
    entries.push(`<url><loc>${url}</loc>${alternates}</url>`)
  }

  return entries
}

async function builtPages(root: string): Promise<string[]> {
  const found: string[] = []

  async function walk(dir: string, prefix: string): Promise<void> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        await walk(join(dir, entry.name), `${prefix}${entry.name}/`)
      } else if (entry.name === 'index.html') {
        found.push(`/${prefix}`)
      }
    }
  }

  await walk(root, '')
  return found.sort()
}

/** Built pages that are a meta-refresh redirect rather than content. */
async function redirectStubs(
  root: string,
  paths: string[]
): Promise<Set<string>> {
  const stubs = new Set<string>()
  for (const path of paths) {
    const html = await readFile(join(root, path, 'index.html'), 'utf8')
    if (html.includes('http-equiv="refresh"')) stubs.add(path)
  }
  return stubs
}

export function localizedSitemap(site: string): AstroIntegration {
  return {
    name: 'comfy:localized-sitemap',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const root = fileURLToPath(dir)
        const file = join(root, 'sitemap-0.xml')

        let xml: string
        try {
          xml = await readFile(file, 'utf8')
        } catch {
          logger.warn('sitemap-0.xml is missing; nothing to complete')
          return
        }

        const existing = new Set(
          [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
        )
        const origin = new URL(site).origin
        const pages = await builtPages(root)
        const entries = missingSitemapEntries(
          pages,
          existing,
          origin,
          await redirectStubs(root, pages)
        )

        if (entries.length === 0) {
          logger.info('sitemap already lists every built page')
          return
        }

        await writeFile(
          file,
          xml.replace('</urlset>', `${entries.join('')}</urlset>`),
          'utf8'
        )
        logger.info(
          `added ${entries.length} localized page(s) the sitemap had omitted`
        )
      }
    }
  }
}
