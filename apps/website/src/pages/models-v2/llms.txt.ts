// A/B TEST PREVIEW — agent-readable catalog for the /models-v2 preview
// (fal-style llms.txt). Delete with the preview pages.
import type { APIRoute } from 'astro'

import { dirLabel, launches, registryModels } from '../../config/models-v2-demo'

export const GET: APIRoute = ({ site }) => {
  const base = new URL('/models-v2', site ?? 'https://comfy.org').href
  const lines: string[] = [
    '# AI Models in ComfyUI — preview catalog',
    '',
    '> Run 200+ open-weights and partner models with professional control,',
    '> in the browser on Comfy Cloud or locally in ComfyUI. Five free runs',
    '> after sign-in, no card. Prices below are estimates.',
    '',
    '## Featured launches',
    ''
  ]
  for (const l of launches) {
    lines.push(
      `- [${l.name}](${base}/${l.slug === 'wan-2-2' ? 'wan' : l.slug}): ${l.blurb} ` +
        `(${l.kind}, ${l.price.replace(' · est.', ' est.')}${l.dayZero ? ', day-zero supported' : ''})`
    )
  }
  lines.push('', '## Registry', '')
  for (const m of registryModels) {
    lines.push(
      `- [${m.displayName}](${base}/${m.slug}): ${dirLabel[m.directory] ?? m.directory}, ${m.workflowCount} workflows`
    )
  }
  lines.push(
    '',
    '## Platform',
    '',
    '- [Comfy Cloud](https://cloud.comfy.org): hosted GPUs, every model, one subscription',
    '- [Download ComfyUI](https://comfy.org/download): open source, runs locally, free forever',
    '- [Workflows](https://comfy.org/workflows): ready-to-run community graphs',
    '- [Docs](https://docs.comfy.org): tutorials and API reference'
  )
  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  })
}
