// A/B TEST PREVIEW — per-model markdown twin (fal-style LLMs surface).
// Every model page has a .md sibling: /models-v2/flux-3.md
// Delete with the preview pages.
import type { APIRoute } from 'astro'

import {
  launches,
  registryModels,
  topPartnerApis,
  modalityMeta,
  dirLabel,
  type LaunchModel
} from '../../config/models-v2-demo'

const launchLike = [
  ...launches,
  ...topPartnerApis.filter((p) => !launches.includes(p))
]
const launchSlugs = new Set(launchLike.map((l) => l.slug))

export function getStaticPaths() {
  const launchPaths = launchLike.map((l) => ({
    params: { slug: l.slug },
    props: { launch: l, registry: null }
  }))
  const wanAlias = {
    params: { slug: 'wan' },
    props: {
      launch: launchLike.find((l) => l.slug === 'wan-2-2')!,
      registry: null
    }
  }
  const registryPaths = registryModels
    .filter((m) => !launchSlugs.has(m.slug) && m.slug !== 'wan')
    .map((m) => ({
      params: { slug: m.slug },
      props: { launch: null, registry: m }
    }))
  return [...launchPaths, wanAlias, ...registryPaths]
}

interface MdProps {
  launch: LaunchModel | null
  registry: (typeof registryModels)[number] | null
}

export const GET: APIRoute = ({ props, params, site }) => {
  const { launch, registry } = props as MdProps
  const name = launch ? launch.name : registry!.displayName
  const slugId = launch ? launch.slug : registry!.slug
  const kind = launch
    ? launch.kind
    : registry!.directory === 'partner_nodes'
      ? 'partner api'
      : 'open weights'
  const modality = launch ? launch.modality : 'image'
  const baseCredits = kind === 'partner api' ? 12 : 6
  const base = site ?? 'https://comfy.org'
  const pageUrl = new URL(`/models-v2/${params.slug}`, base).href

  const lines = [
    `# ${name} in ComfyUI`,
    '',
    launch
      ? launch.blurb
      : `${name}: ${dirLabel[registry!.directory] ?? registry!.directory} in the Comfy model registry.`,
    '',
    '## Facts',
    '',
    `- Type: ${modalityMeta[modality].label}`,
    `- License: ${kind}`,
    `- Price: ~${baseCredits} credits per run (≈ $${(baseCredits * 0.0084).toFixed(2)}, estimate; 1080p or 10s doubles it)`,
    ...(registry
      ? [`- Workflow templates using it: ${registry.workflowCount}`]
      : []),
    ...(registry?.huggingFaceUrl
      ? [`- Weights: ${registry.huggingFaceUrl}`]
      : []),
    ...(launch?.launchUrl ? [`- Launch page: ${launch.launchUrl}`] : []),
    '',
    '## How to run it',
    '',
    `1. Browser playground: ${pageUrl} — five free runs after sign-in, no card.`,
    '2. Comfy Cloud (full graph, every parameter): https://cloud.comfy.org',
    '3. Locally in ComfyUI (open source, free forever): https://comfy.org/download',
    '',
    '## API',
    '',
    '```bash',
    'curl -X POST https://api.comfy.org/v1/run \\',
    '  -H "Authorization: Bearer $COMFY_KEY" \\',
    `  -d '{ "workflow": "${slugId}", "prompt": "…" }'`,
    '```',
    '',
    `Full catalog: ${new URL('/models-v2/llms.txt', base).href}`
  ]
  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' }
  })
}
