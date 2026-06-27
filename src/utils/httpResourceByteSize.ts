const CONTENT_RANGE_TOTAL = /\/(\d+)$/

const MIN_PLAUSIBLE_VIDEO_BYTES = 1024

function parseContentLength(header: string | null): number | undefined {
  if (!header) return undefined
  const bytes = Number.parseInt(header, 10)
  if (!Number.isFinite(bytes) || bytes < MIN_PLAUSIBLE_VIDEO_BYTES) {
    return undefined
  }
  return bytes
}

function parseContentRangeTotal(header: string | null): number | undefined {
  if (!header) return undefined
  const match = header.match(CONTENT_RANGE_TOTAL)
  if (!match) return undefined
  return parseContentLength(match[1])
}

export async function fetchHttpResourceByteSize(
  url: string
): Promise<number | undefined> {
  try {
    const headResponse = await fetch(url, { method: 'HEAD' })
    if (headResponse.ok) {
      const fromHead = parseContentLength(
        headResponse.headers.get('Content-Length')
      )
      if (fromHead != null) return fromHead
    }
  } catch {
    // Range fallback below
  }

  try {
    const rangeResponse = await fetch(url, {
      headers: { Range: 'bytes=0-0' }
    })
    if (!rangeResponse.ok && rangeResponse.status !== 206) {
      return undefined
    }
    return parseContentRangeTotal(rangeResponse.headers.get('Content-Range'))
  } catch {
    return undefined
  }
}
