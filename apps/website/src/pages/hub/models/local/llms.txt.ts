// llms.txt for the model files section: a machine-readable catalog of every
// model file page, each pointing at its markdown twin.
import type { APIRoute } from 'astro'

import { dirLabels } from '@/config/model-descriptions'
import { localModelTwinPath, localModels } from '@/config/local-models'
import { getRoutes } from '@/config/routes'

export const GET: APIRoute = ({ site }) => {
  const base = site ?? 'https://comfy.org'

  const lines = [
    '# Supported models in ComfyUI',
    '',
    '> Every model file on this list runs in ComfyUI, locally on your own hardware or on Comfy Cloud. Hosted models you call through an API are listed at https://comfy.org/hub/models/. Pages under Models have a markdown twin at the same URL plus `.md`; the Latest model launches links are HTML launch pages without twins.',
    '',
    '## Models',
    ''
  ]

  for (const model of localModels) {
    const mdUrl = new URL(localModelTwinPath(model.slug), base).href
    const label = dirLabels[model.directory] ?? model.directory
    const templates = `${model.workflowCount} workflow template${model.workflowCount === 1 ? '' : 's'}`
    lines.push(`- [${model.displayName}](${mdUrl}): ${label}, ${templates}`)
  }

  // Recent releases live on dedicated launch pages before their file-level
  // registry entries exist — list them so the catalog covers the newest models.
  const routes = getRoutes('en')
  const launchPages: Array<[string, string]> = [
    ['FLUX 3', routes.flux3],
    ['MiniMax H3', routes.minimax],
    ['MiniMax Music 3', routes.minimaxMusic3],
    ['Seedance 2.5', routes.seedance],
    ['ChatGPT Images 2.5', routes.chatgptImage25],
    ['Qwen-Image 2.1', routes.qwenImage21],
    ['Wan 3.0', routes.wan3],
    ['Wan Animate 2', routes.wanAnimate2],
    ['LTX 2.5', routes.ltx]
  ]
  lines.push('', '## Latest model launches', '')
  for (const [name, path] of launchPages) {
    lines.push(`- [${name}](${new URL(path, base).href}): launch page`)
  }

  lines.push(
    '',
    '## Run them',
    '',
    '- [ComfyUI, open source](https://comfy.org/download/): free on your own hardware (open models; partner models call the provider API)',
    '- [Comfy Cloud](https://cloud.comfy.org): hosted GPUs, same graph, every parameter',
    '- [Workflow templates](https://comfy.org/workflows/): community workflows, ready to load',
    '- [Comfy SDKs](https://docs.comfy.org/development/api-development/sdks.md): run workflows from Python or TypeScript (beta)',
    '- [Comfy CLI](https://docs.comfy.org/agent-tools/cli.md): run workflows and partner models from a terminal or a coding agent',
    '- [Comfy MCP](https://docs.comfy.org/agent-tools/mcp.md): drive ComfyUI from Claude Code, Cursor, or Codex; the hosted server is https://cloud.comfy.org/mcp',
    `- [Site index](${new URL('/llms.txt', base).href}): every Comfy surface, for agents`
  )

  return new Response(lines.join('\n') + '\n', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  })
}
