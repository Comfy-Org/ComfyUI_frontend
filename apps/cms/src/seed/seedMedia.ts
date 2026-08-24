import { existsSync } from 'node:fs'
import { mkdir, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Payload } from 'payload'

import { ensureFaststart } from './faststart'

// Upload a local file to the media collection unless a doc with the same
// filename already exists. The idempotency check and Payload's stored filename
// both key on the file's basename, so `filePath` must be named as it should be
// stored (callers place it in the cache under that name). Alt text is written
// per locale (`alt` at the default locale, `zhAlt` at zh-CN) on both the
// create and existing-doc paths, so re-running the seed restores alt values
// lost when a schema change moves the column (e.g. localizing `alt`).
export const uploadMediaFile = async (
  payload: Payload,
  filePath: string,
  { alt, zhAlt, faststart }: { alt: string; zhAlt?: string; faststart?: boolean },
): Promise<number> => {
  if (faststart) await ensureFaststart(filePath)

  const filename = path.basename(filePath)

  const existing = await payload.find({
    collection: 'media',
    where: { filename: { equals: filename } },
    limit: 1,
  })

  const existingId = existing.docs.length > 0 ? (existing.docs[0].id as number) : undefined

  if (existingId !== undefined) {
    await payload.update({ collection: 'media', id: existingId, data: { alt } })
  }

  // Reuse the exact filename instead of letting Payload suffix it (-1, -2, …)
  // when a file of that name lingers in the upload dir from a prior seed — the
  // idempotency `find` above keys on this filename.
  const id =
    existingId ??
    ((
      await payload.create({
        collection: 'media',
        filePath,
        data: { alt },
        overwriteExistingFiles: true,
      })
    ).id as number)

  if (zhAlt) {
    await payload.update({
      collection: 'media',
      id,
      locale: 'zh-CN',
      data: { alt: zhAlt },
    })
  }

  return id
}

// Download the asset once into the gitignored cache, then upload it to the
// media collection. Both the cache and the idempotency check key on the
// caller-supplied filename.
export const seedMedia = async (
  payload: Payload,
  cacheDir: string,
  {
    url,
    filename,
    alt,
    zhAlt,
    faststart,
  }: { url: string; filename: string; alt: string; zhAlt?: string; faststart?: boolean },
): Promise<number> => {
  const cachePath = path.join(cacheDir, filename)

  if (!existsSync(cachePath)) {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to download ${url}: ${response.status}`)
    }
    const buffer = Buffer.from(await response.arrayBuffer())
    await mkdir(cacheDir, { recursive: true })
    const tempPath = `${cachePath}.tmp`
    await writeFile(tempPath, buffer)
    await rename(tempPath, cachePath)
  }

  return uploadMediaFile(payload, cachePath, { alt, zhAlt, faststart })
}
