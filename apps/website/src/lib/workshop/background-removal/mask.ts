export const CUTOUT_EXAMPLE = {
  url: '/images/apps/background-removal/plant.jpg',
  name: 'potted-plant.jpg',
  width: 1200,
  height: 896,
  /** The example's prepared cut-out: the plant on a transparent background. */
  cutout: '/images/apps/background-removal/plant-cutout.webp',
  /** The example's prepared Replace result. */
  replaced: '/images/apps/background-removal/plant-replaced.jpg'
} as const

/** Where an upload's subject is assumed to be: a soft, centred oval. */
export const UPLOAD_SUBJECT = { cx: 0.5, cy: 0.54, rx: 0.36, ry: 0.44 } as const

/** How far into the oval it stays fully opaque before fading out. */
export const UPLOAD_SOLID = 0.72

/** The matte for a photo, when one is prepared: its alpha is the subject. */
export function subjectMatte(imageUrl: string): string | undefined {
  return imageUrl === CUTOUT_EXAMPLE.url ? CUTOUT_EXAMPLE.cutout : undefined
}

/** The subject's matte as a CSS `mask-image`, for live previews. */
export function subjectMaskImage(imageUrl: string): string {
  const matte = subjectMatte(imageUrl)
  if (matte) return `url("${matte}")`
  const { cx, cy, rx, ry } = UPLOAD_SUBJECT
  return `radial-gradient(ellipse ${rx * 100}% ${ry * 100}% at ${cx * 100}% ${cy * 100}%, #000 ${UPLOAD_SOLID * 100}%, transparent 100%)`
}
