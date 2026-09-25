export function sampleCreativePalette(bitmap: ImageBitmap): string[] {
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Canvas unavailable')
  context.drawImage(bitmap, 0, 0)
  const data = context.getImageData(0, 0, canvas.width, canvas.height).data
  const buckets = new Map<string, number>()
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue
    const color =
      '#' +
      [data[i], data[i + 1], data[i + 2]]
        .map((value) =>
          Math.min(255, Math.round(value / 32) * 32)
            .toString(16)
            .padStart(2, '0')
        )
        .join('')
    buckets.set(color, (buckets.get(color) ?? 0) + 1)
  }
  if (!buckets.size) throw new Error('Empty image')
  return [...buckets]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([color]) => color)
}
