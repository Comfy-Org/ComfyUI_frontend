/** @knipIgnoreUsedByStackedPR */
export type VideoFormat = 'webm' | 'mp4'

/** @knipIgnoreUsedByStackedPR */
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

/**
 * Stable identifier for a list of video sources, suitable as a Vue `key`.
 * Browsers do not reload a `<video>` when nested `<source>` children change;
 * keying the parent forces a remount when the source set changes.
 */
export function videoKey(sources: VideoSource[]): string {
  return sources.map((s) => s.src).join('|')
}
