import { z } from 'zod'

import { api } from '@/scripts/api'

export interface VideoMetadata {
  fps: number | null
  duration: number | null
  frame_count: number | null
  width: number | null
  height: number | null
  size?: number
}

const zAssetVideoMetadata = z.object({
  kind: z.literal('video'),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  duration: z.number().nonnegative().finite().nullish(),
  fps: z.number().positive().finite().nullish(),
  frame_count: z.number().int().nonnegative().nullish()
})

const zAssetListResponse = z.object({
  assets: z.array(
    z.object({
      name: z.string(),
      size: z.number().nonnegative().finite().optional(),
      metadata: z.record(z.unknown()).nullish()
    })
  )
})

interface ViewFileRef {
  filename: string
  subfolder: string | null
  type: string | null
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

function parseViewUrl(videoUrl: string): ViewFileRef | undefined {
  let url: URL
  try {
    url = new URL(videoUrl, window.location.origin)
  } catch {
    return undefined
  }
  if (!isTrustedOrigin(url)) return undefined
  if (!url.pathname.endsWith('/view')) return undefined

  const filename = url.searchParams.get('filename')
  if (!filename) return undefined

  return {
    filename,
    subfolder: url.searchParams.get('subfolder') || null,
    type: url.searchParams.get('type') || null
  }
}

export async function fetchVideoMetadata(
  videoUrl: string
): Promise<VideoMetadata | undefined> {
  const file = parseViewUrl(videoUrl)
  if (!file) return undefined

  const includeTags = [file.type ?? 'input']
  if (file.subfolder) includeTags.push(file.subfolder)
  const params = new URLSearchParams({
    include_tags: includeTags.join(','),
    name_contains: file.filename,
    limit: '100'
  })

  try {
    const response = await api.fetchApi(`/assets?${params}`)
    if (!response.ok) return undefined
    const { assets } = zAssetListResponse.parse(await response.json())
    const asset = assets.find((entry) => entry.name === file.filename)
    if (!asset) return undefined

    const parsed = zAssetVideoMetadata.safeParse(asset.metadata)
    if (!parsed.success) {
      return {
        fps: null,
        duration: null,
        frame_count: null,
        width: null,
        height: null,
        size: asset.size
      }
    }
    return {
      fps: parsed.data.fps ?? null,
      duration: parsed.data.duration ?? null,
      frame_count: parsed.data.frame_count ?? null,
      width: parsed.data.width,
      height: parsed.data.height,
      size: asset.size
    }
  } catch {
    return undefined
  }
}
