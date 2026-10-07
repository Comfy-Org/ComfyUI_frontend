// Per-model markdown twin: every model page has a .md sibling at the same URL,
// e.g. /hub/models/local/flux-1-dev.md, for agents and the LLMs menu.
// Content mirrors the HTML page via the shared model-descriptions module.
import type { APIRoute } from 'astro'

import {
  buildWhatIsDescription,
  dirLabels,
  isPartnerModel
} from '@/config/model-descriptions'
import { buildPricingFact } from '@/config/model-pricing'
import {
  LOCAL_MODELS_PATH,
  localModelPath,
  localModels
} from '@/config/local-models'
import type { Model } from '@/config/models'

export function getStaticPaths() {
  return localModels.map((model) => ({
    params: { slug: model.slug },
    props: { model }
  }))
}

export const GET: APIRoute = ({ props, site }) => {
  const model = props.model as Model
  const base = site ?? 'https://comfy.org'
  const pageUrl = new URL(localModelPath(model.slug), base).href
  const workflowsUrl = model.hubSlug
    ? `https://comfy.org/workflows/model/${model.hubSlug}/`
    : 'https://comfy.org/workflows/'

  const description = buildWhatIsDescription(model)
  const summary = description.split('. ')[0]

  const lines = [
    '---',
    `title: ${JSON.stringify(`${model.displayName} in ComfyUI`)}`,
    `description: ${JSON.stringify(summary.endsWith('.') ? summary : `${summary}.`)}`,
    `canonical: ${pageUrl}`,
    'lang: en',
    `index: ${new URL('/llms.txt', base).href}`,
    '---',
    '',
    `# ${model.displayName} in ComfyUI`,
    '',
    description,
    '',
    '## Facts',
    '',
    `- Type: ${dirLabels[model.directory] ?? model.directory}`,
    `- ${buildPricingFact(model.slug, isPartnerModel(model))}`,
    `- Community workflow templates: ${model.workflowCount}`,
    ...(model.huggingFaceUrl ? [`- Weights: ${model.huggingFaceUrl}`] : []),
    ...(model.docsUrl ? [`- Tutorial: ${model.docsUrl}`] : []),
    ...(model.blogUrl ? [`- Release notes: ${model.blogUrl}`] : []),
    '',
    `## How to run ${model.displayName}`,
    '',
    ...(isPartnerModel(model)
      ? [
          "1. In ComfyUI through partner nodes — inference runs on the provider's API, no local weights or GPU required: https://comfy.org/download/",
          '2. On Comfy Cloud — the same graph, hosted end to end: https://cloud.comfy.org'
        ]
      : [
          '1. Locally in ComfyUI — open source, free on your own hardware: https://comfy.org/download/',
          '2. On Comfy Cloud — hosted GPUs, every parameter still exposed: https://cloud.comfy.org'
        ]),
    `3. Start from a community workflow template and adjust it node by node: ${workflowsUrl}`,
    '4. From your own application with the Comfy SDKs (Python and TypeScript, beta): https://docs.comfy.org/development/api-development/sdks.md',
    ...(isPartnerModel(model)
      ? [
          '5. From a terminal or a coding agent with Comfy CLI; `comfy generate list` shows the partner models your CLI version can call: https://docs.comfy.org/agent-tools/cli.md'
        ]
      : [
          '5. From a terminal or a coding agent with Comfy CLI, which runs workflows on Comfy Cloud or a local ComfyUI: https://docs.comfy.org/agent-tools/cli.md'
        ]),
    '6. From Claude Code, Cursor, or Codex over Comfy MCP at https://cloud.comfy.org/mcp: https://docs.comfy.org/agent-tools/mcp.md',
    '',
    `This page as HTML: ${pageUrl}`,
    `Full model catalog: ${new URL(`${LOCAL_MODELS_PATH}/llms.txt`, base).href}`
  ]

  return new Response(lines.join('\n') + '\n', {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' }
  })
}
