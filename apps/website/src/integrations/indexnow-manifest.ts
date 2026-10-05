import type { AstroIntegration } from 'astro'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { INDEXNOW_MANIFEST_FILE } from '@/config/indexnow'
import { readBuiltPage } from '@/integrations/markdown-twins'
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

export async function buildIndexNowManifest(
  root: string
): Promise<IndexNowManifest> {
  const manifest: IndexNowManifest = {}
  for (const url of await sitemapUrls(root)) {
    const html = await readBuiltPage(root, decodeURI(new URL(url).pathname))
    const fingerprint = html && pageFingerprint(html, url)
    if (fingerprint) manifest[url] = fingerprint
  }
  return manifest
}

/** Writes the sitemap's content fingerprints; the deploy diffs it against prod. */
export function indexNowManifest(): AstroIntegration {
  return {
    name: 'comfy:indexnow-manifest',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const root = fileURLToPath(dir)
        const manifest = await buildIndexNowManifest(root)
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
