import type { AstroIntegration } from 'astro'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { INDEXNOW_MANIFEST_FILE } from '@/config/indexnow'
import { readBuiltPage } from '@/integrations/markdown-twins'
import { markdownTwinPath } from '@/lib/markdown-twin-path'
import { pageFingerprint } from '@/lib/indexnow'
import type { IndexNowManifest } from '@/lib/indexnow'
import { sitemapChunkNames } from '@/utils/hreflangAudit'

async function sitemapUrls(root: string): Promise<string[]> {
  const index = await readFile(join(root, 'sitemap-index.xml'), 'utf8')
  const chunks = await Promise.all(
    sitemapChunkNames(index).map((name) => readFile(join(root, name), 'utf8'))
  )
  return chunks.flatMap((xml) =>
    [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].trim())
  )
}

async function readOptional(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, 'utf8')
  } catch {
    return undefined
  }
}

/**
 * `astroOutputs` are the files Astro rendered. A twin among them came from a
 * page endpoint, not from the HTML, so only other twins stand in for the HTML.
 */
export async function buildIndexNowManifest(
  root: string,
  astroOutputs: ReadonlySet<string> = new Set()
): Promise<IndexNowManifest> {
  const manifest: IndexNowManifest = {}
  for (const url of await sitemapUrls(root)) {
    const pathname = decodeURI(new URL(url).pathname)
    const html = await readBuiltPage(root, pathname)
    if (!html) continue
    const twinFile = join(root, markdownTwinPath(pathname))
    const twin = astroOutputs.has(twinFile)
      ? undefined
      : await readOptional(twinFile)
    const fingerprint = pageFingerprint(html, url, twin)
    if (fingerprint) manifest[url] = fingerprint
  }
  return manifest
}

/** Writes the sitemap's content fingerprints; the deploy diffs it against prod. */
export function indexNowManifest(): AstroIntegration {
  return {
    name: 'comfy:indexnow-manifest',
    hooks: {
      'astro:build:done': async ({ dir, assets, logger }) => {
        const root = fileURLToPath(dir)
        const astroOutputs = new Set(
          [...assets.values()].flat().map((file) => fileURLToPath(file))
        )
        const manifest = await buildIndexNowManifest(root, astroOutputs)
        await writeFile(
          join(root, INDEXNOW_MANIFEST_FILE),
          `${JSON.stringify(manifest, null, 2)}\n`,
          'utf8'
        )
        logger.info(
          `wrote ${INDEXNOW_MANIFEST_FILE} with ${Object.keys(manifest).length} URLs`
        )
      }
    }
  }
}
