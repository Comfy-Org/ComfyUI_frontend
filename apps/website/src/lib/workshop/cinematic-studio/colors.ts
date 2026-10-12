/*
 * A colour palette sent as words, not as an image: it adds no reference, so it
 * costs nothing extra and every model can follow it. Sampling a picture reads
 * its colours in the browser; the picture itself is never uploaded.
 */

export const MAX_COLORS = 8

const HEX = /^#[0-9a-f]{6}$/i

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX.test(value)
}

/** The prompt sentences a palette adds, main colour last. */
export function colorPromptSentences(
  colors: readonly string[],
  main?: number
): readonly string[] {
  const palette = colors.filter(isHexColor).slice(0, MAX_COLORS)
  if (!palette.length) return []
  const sentences = [
    `Color grade: dominant colors ${palette.join(', ')}. Keep skin tones believable.`
  ]
  const lead = main === undefined ? undefined : colors[main]
  if (isHexColor(lead))
    sentences.push(
      `Palette priority: ${lead} is the main color; use the other palette colors as supporting accents. Preserve believable skin tones and readable contrast.`
    )
  return sentences
}

/**
 * The most common colours in RGBA pixel data, each channel rounded to steps
 * of 32 so near-identical shades count together; transparent pixels skipped.
 */
export function dominantColors(
  pixels: Uint8ClampedArray,
  limit = MAX_COLORS
): readonly string[] {
  const counts = new Map<string, number>()
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue
    const color =
      '#' +
      [pixels[i], pixels[i + 1], pixels[i + 2]]
        .map((value) =>
          Math.min(255, Math.round(value / 32) * 32)
            .toString(16)
            .padStart(2, '0')
        )
        .join('')
    counts.set(color, (counts.get(color) ?? 0) + 1)
  }
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([color]) => color)
}

const SAMPLE_SIZE = 80
const SAMPLE_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const SAMPLE_MAX_BYTES = 10 * 1024 * 1024

/** Reads a picture's dominant colours in the browser. */
export async function sampleImageColors(
  file: File,
  limit = MAX_COLORS
): Promise<readonly string[]> {
  if (!SAMPLE_TYPES.includes(file.type) || file.size > SAMPLE_MAX_BYTES)
    throw new Error('Unsupported image')
  // Pixelated keeps every sampled pixel a real colour from the picture;
  // smooth resizing invents blends along every edge.
  const bitmap = await createImageBitmap(file, {
    resizeWidth: SAMPLE_SIZE,
    resizeHeight: SAMPLE_SIZE,
    resizeQuality: 'pixelated'
  })
  try {
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('Canvas unavailable')
    context.drawImage(bitmap, 0, 0)
    const colors = dominantColors(
      context.getImageData(0, 0, canvas.width, canvas.height).data,
      limit
    )
    if (!colors.length) throw new Error('Empty image')
    return colors
  } finally {
    bitmap.close()
  }
}
