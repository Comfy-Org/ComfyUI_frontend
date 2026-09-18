export async function rasterizeSvgImage(options: {
  svg: string
  signal?: AbortSignal
}): Promise<string> {
  const { svg, signal } = options
  signal?.throwIfAborted()
  if (new Blob([svg]).size > 4 * 1024 * 1024 || /<!DOCTYPE/i.test(svg))
    throw new Error('SVG exceeds the supported document limits')
  const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml')
  const root = parsed.documentElement
  if (
    root.localName !== 'svg' ||
    root.namespaceURI !== 'http://www.w3.org/2000/svg' ||
    parsed.getElementsByTagName('parsererror').length
  )
    throw new Error('Invalid SVG document')
  const viewBox = root
    .getAttribute('viewBox')
    ?.trim()
    .split(/[\s,]+/)
    .map(Number)
  const width =
    Number(root.getAttribute('width')?.replace(/px$/, '')) || viewBox?.[2]
  const height =
    Number(root.getAttribute('height')?.replace(/px$/, '')) || viewBox?.[3]
  if (
    !width ||
    !height ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0 ||
    width > 8192 ||
    height > 8192 ||
    Math.ceil(width) * Math.ceil(height) > 16 * 1024 * 1024
  )
    throw new Error('SVG exceeds the supported image dimensions')
  root.setAttribute('width', String(Math.ceil(width)))
  root.setAttribute('height', String(Math.ceil(height)))
  const source = URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(root)], {
      type: 'image/svg+xml'
    })
  )
  const image = new Image()
  const canvas = document.createElement('canvas')
  try {
    await new Promise<void>((resolve, reject) => {
      const abort = () =>
        finish(signal?.reason ?? new Error('SVG rendering cancelled'))
      const timer = setTimeout(
        () => finish(new Error('SVG rendering timed out')),
        5_000
      )
      function finish(error?: unknown) {
        clearTimeout(timer)
        signal?.removeEventListener('abort', abort)
        if (error) reject(error)
        else resolve()
      }
      image.onload = () => finish()
      image.onerror = () => finish(new Error('SVG image could not be decoded'))
      signal?.addEventListener('abort', abort, { once: true })
      image.src = source
    })
    signal?.throwIfAborted()
    canvas.width = Math.ceil(width)
    canvas.height = Math.ceil(height)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Image rendering is unavailable')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const png = canvas.toDataURL('image/png')
    signal?.throwIfAborted()
    if (
      !png.startsWith('data:image/png;base64,') ||
      png.length > 48 * 1024 * 1024
    )
      throw new Error('Rendered image exceeds the output limit')
    return png
  } finally {
    image.onload = null
    image.onerror = null
    image.src = ''
    URL.revokeObjectURL(source)
    canvas.width = 0
    canvas.height = 0
  }
}
