import { existsSync } from 'node:fs'
import { mkdir, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Payload } from 'payload'

// Download the asset once into the gitignored cache, then upload it to the
// media collection unless a doc with the same filename already exists. Both
// the cache and the idempotency check key on the caller-supplied filename.
export const seedMedia = async (
  payload: Payload,
  cacheDir: string,
  { url, filename, alt }: { url: string; filename: string; alt: string },
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

  const existing = await payload.find({
    collection: 'media',
    where: { filename: { equals: filename } },
    limit: 1,
  })

  if (existing.docs.length > 0) {
    return existing.docs[0].id as number
  }

  // Reuse the exact filename instead of letting Payload suffix it (-1, -2, …)
  // when a file of that name lingers in the upload dir from a prior seed — the
  // idempotency `find` above keys on this filename.
  const created = await payload.create({
    collection: 'media',
    filePath: cachePath,
    data: { alt },
    overwriteExistingFiles: true,
  })
  return created.id as number
}
