import { statSync } from 'node:fs'
import { isAbsolute, relative, resolve, sep } from 'node:path'

/** The media fields used by the Workshop display overlay. */
export interface WorkshopMediaEntry {
  id: string
  media?: {
    thumbnail?: { url: string; poster?: string }
    samples?: { url: string; poster?: string }[]
  }
}

/**
 * Check media served by this site. Remote CDN media is deliberately not
 * checked here: external availability requires a separate network audit.
 */
export function findMissingLocalWorkshopMedia(
  entries: readonly WorkshopMediaEntry[],
  publicDir: string
): string[] {
  const root = resolve(publicDir)
  const missing: string[] = []

  function check(entryId: string, field: string, url: string): void {
    if (!url.startsWith('/')) return

    // A URL's query/fragment is not part of the file stored on disk.
    const encodedPath = url.split(/[?#]/, 1)[0]
    let pathname: string
    try {
      pathname = decodeURIComponent(encodedPath)
    } catch {
      missing.push(`${entryId} ${field}: invalid URL encoding in ${url}`)
      return
    }

    // Prevent traversal and cross-platform backslash/path interpretation.
    if (pathname.startsWith('//') || pathname.includes('\\')) {
      missing.push(`${entryId} ${field}: unsafe local media path ${url}`)
      return
    }

    const candidate = resolve(root, `.${pathname}`)
    const withinRoot = relative(root, candidate)
    if (
      withinRoot === '..' ||
      withinRoot.startsWith(`..${sep}`) ||
      isAbsolute(withinRoot)
    ) {
      missing.push(`${entryId} ${field}: local media path escapes public/ ${url}`)
      return
    }

    try {
      if (statSync(candidate).isFile()) return
    } catch {
      // A missing file is an expected validation failure, not an exception.
    }
    missing.push(`${entryId} ${field}: missing public/ file ${url}`)
  }

  for (const entry of entries) {
    const thumbnail = entry.media?.thumbnail
    if (thumbnail) {
      check(entry.id, 'media.thumbnail.url', thumbnail.url)
      if (thumbnail.poster)
        check(entry.id, 'media.thumbnail.poster', thumbnail.poster)
    }
    for (const [index, sample] of (entry.media?.samples ?? []).entries()) {
      check(entry.id, `media.samples[${index}].url`, sample.url)
      if (sample.poster)
        check(entry.id, `media.samples[${index}].poster`, sample.poster)
    }
  }

  return missing
}
