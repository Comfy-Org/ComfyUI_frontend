import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, basename } from 'node:path'
import { get, fileMetadata } from './catalog-media-verification'
const file = process.env.CCC_DEMO_IMPORT_MANIFEST
const directory = process.env.CCC_DEMO_IMPORT_DIRECTORY
if (!file || !directory)
  throw new Error('Explicit private demo manifest/directory required')
const privateDirectory = directory
const manifest = JSON.parse(await readFile(file, 'utf8'))
await mkdir(directory, { recursive: true, mode: 0o700 })
const verified = new Map<string, object>()
const errors: { url: string; error: string }[] = []
const urls = [
  ...new Set<string>(manifest.media.map((item: { url: string }) => item.url))
]
let next = 0
async function verifyFile(url: string) {
  const payload = await get(url)
  const hash = createHash('sha256').update(payload).digest('hex')
  const path = resolve(privateDirectory, hash)
  await writeFile(path, payload, { mode: 0o600 })
  const filename = basename(new URL(url, 'https://comfy.org').pathname).replace(
    /[^a-zA-Z0-9._-]/g,
    '-'
  )
  const { mime, width, height, duration } = await fileMetadata(
    filename,
    payload,
    path
  )
  return {
    hash_algorithm: 'sha256',
    content_hash: hash,
    storage_key: `ccc/blobs/sha256/${hash}`,
    mime_type: mime,
    byte_size: payload.length,
    original_filename: filename,
    ...(width ? { width, height } : {}),
    ...(duration ? { duration_seconds: duration } : {}),
    legacy_public_url: url
  }
}
async function worker() {
  while (next < urls.length) {
    const url = urls[next++]
    try {
      verified.set(url, await verifyFile(url))
    } catch (error) {
      errors.push({
        url,
        error: verificationError(error)
      })
    }
    if (verified.size % 25 === 0)
      process.stdout.write(
        `Verified ${verified.size}/${urls.length} distinct legacy files; failures=${errors.length}\n`
      )
  }
}
function verificationError(error: unknown) {
  return error instanceof Error
    ? error.message.split('\n')[0].slice(0, 150)
    : 'verification-failed'
}
await Promise.all(Array.from({ length: 6 }, worker))
await writeFile(
  resolve(directory, 'report.json'),
  JSON.stringify(
    { verified: verified.size, expected: urls.length, errors },
    null,
    2
  ),
  { mode: 0o600 }
)
if (errors.length) {
  process.stdout.write(
    `${JSON.stringify({ verified: verified.size, errors })}\n`
  )
  process.exitCode = 1
} else {
  manifest.media = manifest.media.map(
    (item: { url: string; name: string }) => ({
      ...item,
      document: { ...verified.get(item.url), name: item.name }
    })
  )
  await writeFile(
    resolve(directory, 'verified-manifest.json'),
    JSON.stringify(manifest),
    { mode: 0o600 }
  )
  process.stdout.write(
    `Prepared ${manifest.contents.length} CONTENT and ${manifest.media.length} MEDIA uses (${verified.size} verified distinct files); no database changes.\n`
  )
}
