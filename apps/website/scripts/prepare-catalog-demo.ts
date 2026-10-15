import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, basename } from 'node:path'
const run = promisify(execFile)
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
const allowed = new Set([
  'media.comfy.org',
  'comfy-hub-assets.comfy.org',
  'cloud.comfy.org',
  'cdn.jsdelivr.net',
  'raw.githubusercontent.com'
])
async function get(url: string) {
  if (
    url.startsWith('/workflow-graphs/') &&
    !url.includes('..') &&
    !url.includes('?')
  )
    return readFile(resolve('public', url.slice(1)))
  let target = new URL(url)
  for (let redirects = 0; redirects < 4; redirects++) {
    if (
      target.protocol !== 'https:' ||
      !allowed.has(target.hostname) ||
      target.username ||
      target.password ||
      target.hash
    )
      throw new Error('unsupported-source')
    const response = await fetch(target, {
      redirect: 'manual',
      signal: AbortSignal.timeout(45000)
    })
    if (
      response.status >= 300 &&
      response.status < 400 &&
      response.headers.get('Location')
    ) {
      target = new URL(response.headers.get('Location')!, target)
      continue
    }
    if (!response.ok) throw new Error(`HTTP-${response.status}`)
    if (Number(response.headers.get('Content-Length')) > 64 * 1024 * 1024)
      throw new Error('oversized')
    const chunks: Uint8Array[] = []
    let total = 0
    for await (const chunk of response.body!) {
      total += chunk.byteLength
      if (total > 64 * 1024 * 1024) throw new Error('oversized')
      chunks.push(chunk)
    }
    return Buffer.concat(chunks)
  }
  throw new Error('redirect-limit')
}
async function worker() {
  while (next < urls.length) {
    const url = urls[next++]
    try {
      const payload = await get(url)
      const hash = createHash('sha256').update(payload).digest('hex')
      const path = resolve(privateDirectory, hash)
      await writeFile(path, payload, { mode: 0o600 })
      const filename = basename(
        new URL(url, 'https://comfy.org').pathname
      ).replace(/[^a-zA-Z0-9._-]/g, '-')
      let mime = ''
      let width = 0
      let height = 0
      let duration = 0
      if (filename.endsWith('.json')) {
        const data = JSON.parse(payload.toString('utf8'))
        if (!data || typeof data !== 'object' || Array.isArray(data))
          throw new Error('invalid-json-object')
        mime = 'application/json'
      } else if (
        filename.endsWith('.webp') &&
        payload.length >= 30 &&
        payload.toString('ascii', 0, 4) === 'RIFF' &&
        payload.toString('ascii', 8, 16) === 'WEBPVP8X' &&
        payload[20] & 2
      ) {
        if (
          payload.readUInt32LE(4) + 8 !== payload.length ||
          payload.readUInt32LE(16) !== 10
        )
          throw new Error('invalid-animated-webp')
        width = payload.readUIntLE(24, 3) + 1
        height = payload.readUIntLE(27, 3) + 1
        mime = 'image/webp'
        if (width > 16384 || height > 16384)
          throw new Error('invalid-dimensions')
      } else {
        const { stdout } = await run(
          '/opt/homebrew/bin/ffprobe',
          [
            '-v',
            'error',
            '-show_entries',
            'format=format_name,duration:stream=codec_type,codec_name,width,height',
            '-of',
            'json',
            path
          ],
          { timeout: 10000, maxBuffer: 65536 }
        )
        const data = JSON.parse(stdout)
        const video = data.streams?.find(
          (s: { codec_type: string }) => s.codec_type === 'video'
        )
        const ext = filename.split('.').at(-1)?.toLowerCase()
        mime =
          (
            {
              png: 'image/png',
              jpg: 'image/jpeg',
              jpeg: 'image/jpeg',
              webp: 'image/webp',
              mp4: 'video/mp4',
              mp3: 'audio/mpeg'
            } as Record<string, string>
          )[ext ?? ''] ?? ''
        if (!mime) throw new Error('unsupported-format')
        if (video) {
          width = video.width
          height = video.height
        }
        if (
          mime.startsWith('image/') &&
          !['png', 'mjpeg', 'webp'].includes(video?.codec_name)
        )
          throw new Error('image-codec-mismatch')
        if (
          mime === 'video/mp4' &&
          (!video || !String(data.format?.format_name).includes('mp4'))
        )
          throw new Error('invalid-mp4')
        if (
          mime === 'audio/mpeg' &&
          !data.streams?.some(
            (s: { codec_name: string }) => s.codec_name === 'mp3'
          )
        )
          throw new Error('invalid-mp3')
        duration = mime.startsWith('image/')
          ? 0
          : Number(data.format?.duration ?? 0)
        if (
          (mime.startsWith('image/') || mime.startsWith('video/')) &&
          (!(width > 0) || !(height > 0) || width > 16384 || height > 16384)
        )
          throw new Error('invalid-dimensions')
      }
      verified.set(url, {
        hash_algorithm: 'sha256',
        content_hash: hash,
        storage_key: `ccc/blobs/sha256/${hash}`,
        mime_type: mime,
        byte_size: payload.length,
        original_filename: filename,
        ...(width ? { width, height } : {}),
        ...(duration ? { duration_seconds: duration } : {}),
        legacy_public_url: url
      })
    } catch (error) {
      errors.push({
        url,
        error:
          error instanceof Error
            ? error.message.split('\n')[0].slice(0, 150)
            : 'verification-failed'
      })
    }
    if (verified.size % 25 === 0)
      process.stdout.write(
        `Verified ${verified.size}/${urls.length} distinct legacy files; failures=${errors.length}\n`
      )
  }
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
