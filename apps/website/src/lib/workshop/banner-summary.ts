// The banner centres its column inside a frame of one height, so a summary
// that runs to two lines pushes the buttons under it down by a line and they
// move as the carousel turns. A catalogue summary is written for the model
// page, where the room is there; these are the same models said short enough
// to stand on one line at the banner's measure. A model with no line here
// keeps its own summary, which the banner clamps rather than wraps.
const BANNER_SUMMARIES: Record<string, string> = {
  'openai--gpt-image-2--generate-images':
    'Generates or edits an image, and renders text unusually well.',
  'byteplus--seedream-4--generate-images':
    'Generates or edits an image at up to 4K, from up to 10 references.',
  'xai--grok-imagine-image-2.0--generate-images':
    'Generates an image at 1K or 2K, at the quality tier you choose.',
  'vertexai--gemini-nano-banana-2--generate-images':
    'Generates or edits at up to 4K, from as many as 14 references.',
  'workflows/change-material':
    'Try a new fabric, texture or finish on an object, from a reference.'
}

export function bannerSummary(
  slug: string,
  summary: string | undefined
): string | undefined {
  return BANNER_SUMMARIES[slug] ?? summary
}
