// Markdown twin for /models. The page itself gates its catalogue behind a
// client-only PostHog flag, so the built HTML carries only a loading frame and
// htmlToTwin has nothing to export. This renders the public catalogue straight
// from `workshopModels`, independent of the gate, so the twin cannot regress
// when the loading/visibility logic changes.
import type { APIRoute } from 'astro'

import { workshopModels } from '../../config/workshop-browse-content'

const TITLE = 'Models - Comfy'
const DESCRIPTION =
  "Run the world's leading AI models in ComfyUI. Browse every supported model with community workflow templates ready to run."

function modelLine(model: (typeof workshopModels)[number]): string {
  const detail =
    model.summary ?? [model.provider, model.task].filter(Boolean).join(' · ')
  return `- [${model.name}](${model.href})${detail ? ` — ${detail}` : ''}`
}

export const GET: APIRoute = ({ site }) => {
  const base = site ?? 'https://comfy.org'
  const pageUrl = new URL('/models/', base).href

  const lines = [
    '---',
    `title: ${JSON.stringify(TITLE)}`,
    `description: ${JSON.stringify(DESCRIPTION)}`,
    `canonical: ${pageUrl}`,
    'lang: en',
    `index: ${new URL('/llms.txt', base).href}`,
    '---',
    '',
    '# Models in ComfyUI',
    '',
    DESCRIPTION,
    '',
    '## Models',
    '',
    ...workshopModels.map(modelLine),
    '',
    `This page as HTML: ${pageUrl}`
  ]

  return new Response(lines.join('\n') + '\n', {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' }
  })
}
