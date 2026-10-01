export const CUTOUT_EXAMPLE = {
  url: '/images/apps/background-removal/example.jpg',
  name: 'potted-plant.jpg',
  width: 1280,
  height: 960,
  /** The example subject's hand-drawn matte: white where the plant is. */
  mask: '/images/apps/background-removal/example-mask.png'
} as const

/** Where an upload's subject is assumed to be: a soft, centred oval. */
export const UPLOAD_SUBJECT = { cx: 0.5, cy: 0.54, rx: 0.36, ry: 0.44 } as const

/** How far into the oval it stays fully opaque before fading out. */
export const UPLOAD_SOLID = 0.72

/** The matte image for a photo, when one is drawn for it. */
export function subjectMatte(imageUrl: string): string | undefined {
  return imageUrl === CUTOUT_EXAMPLE.url ? CUTOUT_EXAMPLE.mask : undefined
}

/** The subject's matte as a CSS `mask-image`, for live thumbnails. */
export function subjectMaskImage(imageUrl: string): string {
  const matte = subjectMatte(imageUrl)
  if (matte) return `url("${matte}")`
  const { cx, cy, rx, ry } = UPLOAD_SUBJECT
  return `radial-gradient(ellipse ${rx * 100}% ${ry * 100}% at ${cx * 100}% ${cy * 100}%, #000 ${UPLOAD_SOLID * 100}%, transparent 100%)`
}
