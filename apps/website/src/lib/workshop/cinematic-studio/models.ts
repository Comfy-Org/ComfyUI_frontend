const CINEMATIC_PLAYGROUND_SLUGS: ReadonlySet<string> = new Set([
  'byteplus--seedream-4-5--generate-images'
])

export function hasCinematicPlayground(slug: string): boolean {
  return CINEMATIC_PLAYGROUND_SLUGS.has(slug)
}
