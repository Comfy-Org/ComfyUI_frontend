import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { open } from 'node:fs/promises'
import { promisify } from 'node:util'
import { z } from 'zod'

import type { RunOutput } from '../src/config/workshop-run'

const execute = promisify(execFile)
export type MediaKind = 'image' | 'video' | 'audio'

const probeSchema = z.object({
  streams: z.array(
    z.object({
      codec_type: z.string().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
      sample_rate: z.string().optional(),
      channels: z.number().optional()
    })
  ),
  format: z.object({ duration: z.string().optional() })
})

export async function checkMediaDecoders(): Promise<void> {
  for (const program of ['ffprobe', 'ffmpeg']) {
    try {
      await execute(program, ['-version'], { timeout: 10_000 })
    } catch {
      throw new Error(`Install ${program} on PATH before using --execute`)
    }
  }
}

function isImageBytes(bytes: Uint8Array): boolean {
  const prefix = Buffer.from(bytes)
  const ascii = prefix.toString('ascii')
  return (
    prefix.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) ||
    prefix.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex')) ||
    /^(GIF87a|GIF89a|BM)/.test(ascii) ||
    (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP') ||
    prefix.subarray(0, 4).equals(Buffer.from('49492a00', 'hex')) ||
    prefix.subarray(0, 4).equals(Buffer.from('4d4d002a', 'hex')) ||
    (ascii.slice(4, 8) === 'ftyp' &&
      /^(avif|avis|heic|heix|mif1)$/.test(ascii.slice(8, 12)))
  )
}

export function validateMediaProbe(data: unknown, kind: MediaKind) {
  const probe = probeSchema.parse(data)
  const stream = probe.streams.find(
    (item) => item.codec_type === (kind === 'audio' ? 'audio' : 'video')
  )
  if (!stream) throw new Error(`Artifact contains no ${kind} stream`)
  if (kind === 'audio') {
    if (!(Number(stream.sample_rate) > 0) || !(Number(stream.channels) > 0))
      throw new Error('Audio has no playable samples')
  } else if (!(Number(stream.width) > 0) || !(Number(stream.height) > 0)) {
    throw new Error('Artifact has no image dimensions')
  }
  const durationSeconds = Number(probe.format.duration)
  if (kind !== 'image' && !(durationSeconds > 0))
    throw new Error('Artifact has no positive media duration')
  return {
    width: stream.width,
    height: stream.height,
    channels: stream.channels,
    durationSeconds: Number.isFinite(durationSeconds)
      ? durationSeconds
      : undefined
  }
}

export async function downloadArtifact(
  url: string,
  path: string,
  signal: AbortSignal,
  maxBytes: number
) {
  const parsed = new URL(url)
  if (
    !['https:', 'blob:'].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password
  )
    throw new Error('Unsupported artifact URL')
  const response = await fetch(url, { signal, credentials: 'omit' })
  if (!response.ok || !response.body)
    throw new Error(`Artifact download failed (${response.status})`)
  const reader = response.body.getReader()
  const file = await open(path, 'wx', 0o600)
  const hash = createHash('sha256')
  let bytes = 0
  let prefix = Buffer.alloc(0)
  try {
    if (Number(response.headers.get('content-length')) > maxBytes)
      throw new Error('Artifact exceeds byte limit')
    for (;;) {
      signal.throwIfAborted()
      const { value, done } = await reader.read()
      if (done) break
      bytes += value.byteLength
      if (bytes > maxBytes) throw new Error('Artifact exceeds byte limit')
      hash.update(value)
      if (prefix.length < 32)
        prefix = Buffer.concat([prefix, value.subarray(0, 32 - prefix.length)])
      await file.writeFile(value)
    }
    if (!bytes) throw new Error('Artifact is empty')
    return { bytes, prefix, sha256: hash.digest('hex') }
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
    await file.close()
  }
}

export async function validateArtifact(
  output: RunOutput,
  kind: MediaKind,
  path: string,
  signal: AbortSignal,
  maxBytes: number
) {
  const artifact = await downloadArtifact(output.url, path, signal, maxBytes)
  if (isImageBytes(artifact.prefix) !== (kind === 'image'))
    throw new Error(`Downloaded file is not the expected ${kind}`)
  const { stdout } = await execute(
    'ffprobe',
    [
      '-v',
      'error',
      '-protocol_whitelist',
      'file,pipe',
      '-show_streams',
      '-show_format',
      '-of',
      'json',
      path
    ],
    { signal, timeout: 60_000, maxBuffer: 1024 * 1024 }
  )
  const dimensions = validateMediaProbe(JSON.parse(stdout), kind)
  await execute(
    'ffmpeg',
    [
      '-nostdin',
      '-v',
      'error',
      '-xerror',
      '-threads',
      '1',
      '-protocol_whitelist',
      'file,pipe',
      '-i',
      path,
      '-map',
      kind === 'audio' ? '0:a:0' : '0:v:0',
      ...(kind === 'image' ? ['-frames:v', '1'] : []),
      '-f',
      'null',
      '-'
    ],
    { signal, timeout: 120_000, maxBuffer: 1024 * 1024 }
  )
  return {
    kind,
    path,
    bytes: artifact.bytes,
    sha256: artifact.sha256,
    ...dimensions
  }
}
