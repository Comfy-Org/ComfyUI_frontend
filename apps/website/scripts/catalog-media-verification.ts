import { probeFile } from './catalog-media-probe'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
const allowed = new Set([
  'media.comfy.org',
  'comfy-hub-assets.comfy.org',
  'cloud.comfy.org',
  'cdn.jsdelivr.net',
  'raw.githubusercontent.com'
])
export async function get(url: string) {
  if (isLocalGraph(url)) return readFile(resolve('public', url.slice(1)))
  let target = new URL(url)
  for (let redirects = 0; redirects < 4; redirects++) {
    validateSource(target)
    const response = await fetch(target, {
      redirect: 'manual',
      signal: AbortSignal.timeout(45000)
    })
    const location = redirectLocation(response)
    if (location) {
      target = new URL(location, target)
      continue
    }
    return responsePayload(response)
  }
  throw new Error('redirect-limit')
}
function isLocalGraph(url: string) {
  return (
    url.startsWith('/workflow-graphs/') &&
    !url.includes('..') &&
    !url.includes('?')
  )
}
function validateSource(target: URL) {
  if (target.protocol !== 'https:' || !allowed.has(target.hostname))
    throw new Error('unsupported-source')
  validateSourceIdentity(target)
}
function validateSourceIdentity(target: URL) {
  if (target.username || target.password || target.hash)
    throw new Error('unsupported-source')
}
function redirectLocation(response: Response) {
  return response.status >= 300 && response.status < 400
    ? response.headers.get('Location')
    : null
}
async function responsePayload(response: Response) {
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
export async function fileMetadata(
  filename: string,
  payload: Buffer,
  path: string
) {
  if (filename.endsWith('.json')) {
    validateJSON(payload)
    return { mime: 'application/json', width: 0, height: 0, duration: 0 }
  }
  if (filename.endsWith('.webp') && animatedWebp(payload))
    return webpMetadata(payload)
  return probeMetadata(filename, path)
}
function validateJSON(payload: Buffer) {
  const data: unknown = JSON.parse(payload.toString('utf8'))
  if (!data || typeof data !== 'object' || Array.isArray(data))
    throw new Error('invalid-json-object')
}
function animatedWebp(payload: Buffer) {
  return (
    payload.length >= 30 &&
    payload.toString('ascii', 0, 4) === 'RIFF' &&
    payload.toString('ascii', 8, 16) === 'WEBPVP8X' &&
    Boolean(payload[20] & 2)
  )
}
function webpMetadata(payload: Buffer) {
  if (
    payload.readUInt32LE(4) + 8 !== payload.length ||
    payload.readUInt32LE(16) !== 10
  )
    throw new Error('invalid-animated-webp')
  const width = payload.readUIntLE(24, 3) + 1
  const height = payload.readUIntLE(27, 3) + 1
  if (width > 16384 || height > 16384) throw new Error('invalid-dimensions')
  return { mime: 'image/webp', width, height, duration: 0 }
}
type ProbeStream = {
  codec_type: string
  codec_name: string
  width: number
  height: number
}
type Probe = {
  streams?: ProbeStream[]
  format?: { format_name?: string; duration?: string }
}
async function probeMetadata(filename: string, path: string) {
  const { stdout } = await probeFile(path)
  const data: Probe = JSON.parse(stdout)
  const video = data.streams?.find((s) => s.codec_type === 'video')
  const mime = filenameMime(filename)
  validateCodec(mime, data, video)
  const width = video ? video.width : 0
  const height = video ? video.height : 0
  const duration = mime.startsWith('image/')
    ? 0
    : Number(data.format?.duration ?? 0)
  if (mime.startsWith('image/') || mime.startsWith('video/'))
    validateDimensions(width, height)
  return { mime, width, height, duration }
}
function filenameMime(filename: string) {
  const ext = filename.split('.').at(-1)?.toLowerCase()
  const mime =
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
  return mime
}
function validateCodec(
  mime: string,
  data: Probe,
  video: ProbeStream | undefined
) {
  if (
    mime.startsWith('image/') &&
    !['png', 'mjpeg', 'webp'].includes(video?.codec_name ?? '')
  )
    throw new Error('image-codec-mismatch')
  validateVideoAudio(mime, data, video)
}
function validateVideoAudio(
  mime: string,
  data: Probe,
  video: ProbeStream | undefined
) {
  if (
    mime === 'video/mp4' &&
    (!video || !String(data.format?.format_name).includes('mp4'))
  )
    throw new Error('invalid-mp4')
  if (mime === 'audio/mpeg') validateAudio(data)
}
function validateAudio(data: Probe) {
  if (!data.streams?.some((s) => s.codec_name === 'mp3'))
    throw new Error('invalid-mp3')
}
function validateDimensions(width: number, height: number) {
  if (!(width > 0) || !(height > 0) || width > 16384 || height > 16384)
    throw new Error('invalid-dimensions')
}
