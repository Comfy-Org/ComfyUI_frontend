/**
 * Parses a WebVTT caption file into a flat transcript for SSR rendering.
 * Cue timestamps are dropped; consecutive cues are merged into readable
 * paragraphs so the watch page can show a plain-text transcript below the
 * player without re-fetching or re-parsing on the client.
 */
export function parseVttToTranscript(vtt: string): string[] {
  const lines = vtt.replace(/\r\n/g, '\n').split('\n')
  const cues: string[] = []
  let current: string[] = []

  const flush = () => {
    const text = current.join(' ').trim()
    if (text) cues.push(text)
    current = []
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed === '' || trimmed === 'WEBVTT') {
      flush()
      continue
    }
    // Skip cue numbers, timestamp lines, and NOTE/STYLE/REGION blocks.
    if (/^\d+$/.test(trimmed)) continue
    if (trimmed.includes('-->')) continue
    if (/^(NOTE|STYLE|REGION)\b/.test(trimmed)) continue
    current.push(trimmed.replace(/<[^>]+>/g, ''))
  }
  flush()

  // Merge short, choppy cues into paragraph-sized chunks for readability.
  const paragraphs: string[] = []
  let buffer = ''
  for (const cue of cues) {
    buffer = buffer ? `${buffer} ${cue}` : cue
    if (buffer.length > 240) {
      paragraphs.push(buffer)
      buffer = ''
    }
  }
  if (buffer) paragraphs.push(buffer)
  return paragraphs
}

/**
 * Fetches a caption track at build time and returns its transcript
 * paragraphs. Returns an empty array (never throws, never invents text) when
 * the fetch fails — a static build must not go down because a CDN asset is
 * briefly unreachable, and a missing transcript degrades gracefully (the
 * watch page simply omits that section) rather than fabricating content.
 */
export async function fetchTranscript(captionUrl: string): Promise<string[]> {
  try {
    const response = await fetch(captionUrl)
    if (!response.ok) return []
    const vtt = await response.text()
    return parseVttToTranscript(vtt)
  } catch {
    return []
  }
}
