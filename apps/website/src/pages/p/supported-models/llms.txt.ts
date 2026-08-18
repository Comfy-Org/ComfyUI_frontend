// llms.txt for the supported-models section: a machine-readable catalog of
// every model page, each pointing at its markdown twin.
import type { APIRoute } from 'astro'

import { dirLabels } from '../../../config/model-descriptions'
import { models } from '../../../config/models'

export const GET: APIRoute = ({ site }) => {
  const base = site ?? 'https://comfy.org'

  const lines = [
    '# Supported models in ComfyUI',
    '',
    "> Every model on this list runs in ComfyUI. Open models run locally on your own hardware or on Comfy Cloud; partner models run through partner nodes with inference on the provider's API. Each page has a markdown twin at the same URL plus `.md`.",
    '',
    '## Models',
    ''
  ]

  for (const model of models) {
    if (model.canonicalSlug) continue
    const mdUrl = new URL(`/p/supported-models/${model.slug}.md`, base).href
    const label = dirLabels[model.directory] ?? model.directory
    lines.push(
      `- [${model.displayName}](${mdUrl}): ${label}, ${model.workflowCount} workflow templates`
    )
  }

  lines.push(
    '',
    '## Run them',
    '',
    '- [ComfyUI, open source](https://comfy.org/download): free on your own hardware (open models; partner models call the provider API)',
    '- [Comfy Cloud](https://cloud.comfy.org): hosted GPUs, same graph, every parameter',
    '- [Workflow templates](https://www.comfy.org/workflows): community workflows, ready to load'
  )

  return new Response(lines.join('\n') + '\n', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  })
}
