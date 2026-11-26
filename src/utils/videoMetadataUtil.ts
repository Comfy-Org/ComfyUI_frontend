import type { Source } from 'mediabunny'
import { z } from 'zod'

import { api } from '@/scripts/api'

const zVideoMetadata = z.object({
  fps: z.number().positive().finite().nullable(),
  duration: z.number().nonnegative().finite().nullable(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  size: z.number().nonnegative().finite().nullable()
})

export type VideoMetadata = z.infer<typeof zVideoMetadata>

const STANDARD_FRAME_RATES = [
  24_000 / 1_001,
  24,
  25,
  30_000 / 1_001,
  30,
  48,
  50,
  60_000 / 1_001,
  60,
  120
]

const FRAME_RATE_SNAP_TOLERANCE = 0.01

const PACKET_STATS_SAMPLE_SIZE = 100

export function snapToStandardFrameRate(fps: number): number {
  const standard = STANDARD_FRAME_RATES.find(
    (candidate) => Math.abs(fps - candidate) <= FRAME_RATE_SNAP_TOLERANCE
  )
  return standard ?? fps
}

function isTrustedOrigin(url: URL): boolean {
  if (url.origin === window.location.origin) return true
  try {
    const apiBase = new URL(api.apiURL(''), window.location.origin)
    return url.origin === apiBase.origin
  } catch {
    return false
  }
}

function parseProbeableViewUrl(videoUrl: string): URL | undefined {
  let url: URL
  try {
    url = new URL(videoUrl, window.location.origin)
  } catch {
    return undefined
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined
  if (!isTrustedOrigin(url)) return undefined
  if (!url.pathname.endsWith('/view')) return undefined
  if (url.searchParams.get('filename') === null) return undefined
  return url
}

let mediabunnyModulePromise: ReturnType<typeof importMediabunny> | undefined

function importMediabunny() {
  return import('mediabunny')
}

function loadMediabunny() {
  mediabunnyModulePromise ??= importMediabunny().catch((error) => {
    mediabunnyModulePromise = undefined
    throw error
  })
  return mediabunnyModulePromise
}

const METADATA_CACHE_LIMIT = 64

const metadataCache = new Map<string, VideoMetadata>()
const inflightProbes = new Map<string, Promise<VideoMetadata | undefined>>()

function viewCacheKey(url: URL): string {
  const params = url.searchParams
  return JSON.stringify([
    url.origin,
    url.pathname,
    params.get('filename') ?? '',
    params.get('subfolder') ?? '',
    params.get('type') ?? ''
  ])
}

function raceWithAbort<T>(
  promise: Promise<T>,
  signal?: AbortSignal
): Promise<T | undefined> {
  if (!signal) return promise
  if (signal.aborted) return Promise.resolve(undefined)
  return new Promise((resolve) => {
    const onAbort = () => resolve(undefined)
    signal.addEventListener('abort', onAbort, { once: true })
    promise
      .then((value) => resolve(value))
      .catch(() => resolve(undefined))
      .finally(() => signal.removeEventListener('abort', onAbort))
  })
}

export function clearVideoMetadataCache(): void {
  metadataCache.clear()
  inflightProbes.clear()
}

function rememberMetadata(key: string, metadata: VideoMetadata): void {
  metadataCache.delete(key)
  metadataCache.set(key, metadata)
  if (metadataCache.size > METADATA_CACHE_LIMIT) {
    const oldest = metadataCache.keys().next().value
    if (oldest !== undefined) metadataCache.delete(oldest)
  }
}

export async function extractVideoMetadata(
  source: Source,
  signal?: AbortSignal
): Promise<VideoMetadata | undefined> {
  if (signal?.aborted) return undefined

  try {
    const { ALL_FORMATS, Input } = await loadMediabunny()
    const input = new Input({ source, formats: ALL_FORMATS })
    const disposeOnAbort = () => {
      input.dispose()
    }
    signal?.addEventListener('abort', disposeOnAbort, { once: true })
    try {
      const videoTrack = await input.getPrimaryVideoTrack()
      if (!videoTrack) return undefined

      const [duration, packetStats, size, width, height] = await Promise.all([
        input.computeDuration(),
        videoTrack.computePacketStats(PACKET_STATS_SAMPLE_SIZE),
        source.getSizeOrNull(),
        videoTrack.getDisplayWidth(),
        videoTrack.getDisplayHeight()
      ])

      const fps = packetStats.averagePacketRate
      const parsed = zVideoMetadata.safeParse({
        fps:
          Number.isFinite(fps) && fps > 0 ? snapToStandardFrameRate(fps) : null,
        duration: Number.isFinite(duration) && duration >= 0 ? duration : null,
        width,
        height,
        size
      })
      return parsed.success ? parsed.data : undefined
    } finally {
      signal?.removeEventListener('abort', disposeOnAbort)
      input.dispose()
    }
  } catch {
    return undefined
  }
}

async function probeVideoUrl(
  videoUrl: string
): Promise<VideoMetadata | undefined> {
  try {
    const { UrlSource } = await loadMediabunny()
    const source = new UrlSource(videoUrl, { getRetryDelay: () => null })
    return await extractVideoMetadata(source)
  } catch {
    return undefined
  }
}

export async function fetchVideoMetadata(
  videoUrl: string,
  signal?: AbortSignal
): Promise<VideoMetadata | undefined> {
  const url = parseProbeableViewUrl(videoUrl)
  if (!url) return undefined
  if (signal?.aborted) return undefined

  const key = viewCacheKey(url)
  const cached = metadataCache.get(key)
  if (cached) {
    rememberMetadata(key, cached)
    return cached
  }

  let probe = inflightProbes.get(key)
  if (!probe) {
    probe = probeVideoUrl(videoUrl)
      .then((result) => {
        if (result) rememberMetadata(key, result)
        return result
      })
      .finally(() => inflightProbes.delete(key))
    inflightProbes.set(key, probe)
  }
  const result = await raceWithAbort(probe, signal)
  if (signal?.aborted) return undefined
  return result
}
