import { z } from 'zod'

import { api } from '@/scripts/api'

const zVideoMetadata = z.object({
  fps: z.number().positive().finite().nullable(),
  duration: z.number().nonnegative().finite().nullable(),
  frame_count: z.number().int().nonnegative().nullable(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  size: z.number().nonnegative().finite()
})

export type VideoMetadata = z.infer<typeof zVideoMetadata>

function isTrustedOrigin(url: URL): boolean {
  if (url.origin === window.location.origin) return true
  try {
    const apiBase = new URL(api.apiURL(''), window.location.origin)
    return url.origin === apiBase.origin
  } catch {
    return false
  }
}

function viewQueryFromUrl(videoUrl: string): string | undefined {
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

  const params = new URLSearchParams({ filename })
  for (const key of ['subfolder', 'type'] as const) {
    const value = url.searchParams.get(key)
    if (value !== null) params.set(key, value)
  }
  return params.toString()
}

export async function fetchVideoMetadata(
  videoUrl: string
): Promise<VideoMetadata | undefined> {
  const query = viewQueryFromUrl(videoUrl)
  if (!query) return undefined

  try {
    const response = await api.fetchApi(`/video_metadata?${query}`)
    if (!response.ok) return undefined
    return zVideoMetadata.parse(await response.json())
  } catch {
    return undefined
  }
}
