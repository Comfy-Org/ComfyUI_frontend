export type VideoFormat = 'webm' | 'mp4'

export type VideoSource = {
  src: string
  type: `video/${VideoFormat}`
  format: VideoFormat
}

const MIME_TYPES: Record<VideoFormat, VideoSource['type']> = {
  webm: 'video/webm',
  mp4: 'video/mp4'
}

type BuildArgs = {
  name: string
  baseUrl: string
  width: number
  formats: VideoFormat[]
}

/**
 * Expects assets named `${name}-${width}.${format}` under `${baseUrl}/`,
 * matching the output of `apps/website/scripts/process-videos.sh`.
 */
export function buildVideoSources({
  name,
  baseUrl,
  width,
  formats
}: BuildArgs): VideoSource[] {
  const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl

  return formats.map((format) => ({
    src: `${base}/${name}-${width}.${format}`,
    type: MIME_TYPES[format],
    format
  }))
}
