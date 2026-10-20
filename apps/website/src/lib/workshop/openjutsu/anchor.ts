import { fetchModelsPage } from '@/config/models-page-data'
import { releaseRouterOutputs } from '@/config/workshop-response'
import { runWorkshopRouter } from '@/config/workshop-router-queue'
import { frameAt } from './frame'

const ANCHOR_MODEL = 'openai--gpt-image-2.5-sunburst--generate-images'

const ANCHOR_PROMPT =
  "Replace the person in image 1 with the character from image 2, including their face, hair, body and complete outfit exactly as shown in image 2. Do not keep any of the original person's clothing. Keep image 1's pose, framing, background and lighting."

function dataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/** The part's first frame with the character swapped in, made by GPT Image through Comfy Router. */
export async function routerAnchor(options: {
  readonly video: File
  readonly start: number
  readonly character: File
  readonly token: () => Promise<string>
  readonly signal: AbortSignal
}): Promise<File> {
  const { signal } = options
  const [page, frame, token] = await Promise.all([
    fetchModelsPage(ANCHOR_MODEL),
    frameAt(options.video, options.start),
    options.token()
  ])
  const contract = 'execution' in page.model ? page.model.execution : undefined
  if (!contract) throw new Error('anchor model unavailable')
  const result = await runWorkshopRouter({
    contract,
    body: {
      prompt: ANCHOR_PROMPT,
      image: [await dataUrl(frame), await dataUrl(options.character)],
      quality: 'low',
      size: 'auto',
      n: 1,
      moderation: 'auto'
    },
    token,
    freshToken: options.token,
    idempotencyKey: crypto.randomUUID(),
    signal
  })
  const image = result.outputs.find(
    (output) =>
      output.kind === 'image' && output.purpose !== 'response-metadata'
  )
  try {
    if (!image) throw new Error('anchor image missing')
    const response = await fetch(image.download?.url ?? image.url, { signal })
    if (!response.ok) throw new Error(`anchor image ${response.status}`)
    const blob = await response.blob()
    return new File([blob], 'anchor.png', { type: blob.type || 'image/png' })
  } finally {
    releaseRouterOutputs(result.outputs)
  }
}
