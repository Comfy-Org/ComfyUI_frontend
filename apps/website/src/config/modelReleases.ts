import type { Model, ModelDirectory, ModelWorkflowPreview } from './models'
import type { ModelCategory } from './modelCategories'
import { deriveModelCategories } from './modelCategories'

type ModelAccess = 'open' | 'partner'

type ModelComponentRole =
  | 'primary'
  | 'adapter'
  | 'encoder'
  | 'decoder'
  | 'control'
  | 'upscaler'
  | 'utility'
  | 'partner'

interface ModelReleaseComponent {
  readonly slug: string
  readonly displayName: string
  readonly role: ModelComponentRole
  readonly directory: ModelDirectory
  readonly format?: string
  readonly downloadUrl: string
}

export interface ModelRelease {
  readonly slug: string
  readonly familySlug: string
  readonly displayName: string
  readonly publisher: string
  readonly access: ModelAccess
  readonly releaseDate?: string
  readonly categories: readonly ModelCategory[]
  readonly workflows: readonly ModelWorkflowPreview[]
  readonly components: readonly ModelReleaseComponent[]
  readonly thumbnailUrl?: string
}

interface FamilyIdentity {
  familySlug: string
  publisher: string
}

const familyPatterns: readonly [RegExp, FamilyIdentity][] = [
  [/^wan/i, { familySlug: 'wan', publisher: 'Alibaba' }],
  [/^flux/i, { familySlug: 'flux', publisher: 'Black Forest Labs' }],
  [/^qwen/i, { familySlug: 'qwen', publisher: 'Alibaba' }],
  [/^ltx/i, { familySlug: 'ltx', publisher: 'Lightricks' }],
  [/^hunyuan/i, { familySlug: 'hunyuan', publisher: 'Tencent' }],
  [/^seedream/i, { familySlug: 'seedream', publisher: 'ByteDance' }],
  [/^seed audio/i, { familySlug: 'seed-audio', publisher: 'ByteDance' }],
  [/^seed\s*2/i, { familySlug: 'seed', publisher: 'ByteDance' }],
  [/^seedance/i, { familySlug: 'seedance', publisher: 'ByteDance' }],
  [/^bytedance vcube/i, { familySlug: 'vcube', publisher: 'ByteDance' }],
  [/^kling/i, { familySlug: 'kling', publisher: 'Kuaishou' }],
  [/^minimax/i, { familySlug: 'minimax', publisher: 'MiniMax' }],
  [
    /^stable diffusion/i,
    { familySlug: 'stable-diffusion', publisher: 'Stability AI' }
  ],
  [/^ideogram/i, { familySlug: 'ideogram', publisher: 'Ideogram' }],
  [/^ace[ -]?step/i, { familySlug: 'ace-step', publisher: 'ACE Studio' }],
  [/^gemini/i, { familySlug: 'gemini', publisher: 'Google' }],
  [/^grok/i, { familySlug: 'grok', publisher: 'xAI' }],
  [/^openai/i, { familySlug: 'openai', publisher: 'OpenAI' }],
  [/^runway/i, { familySlug: 'runway', publisher: 'Runway' }],
  [/^bria/i, { familySlug: 'bria', publisher: 'Bria AI' }],
  [/^luma/i, { familySlug: 'luma', publisher: 'Luma AI' }],
  [/^recraft/i, { familySlug: 'recraft', publisher: 'Recraft' }],
  [/^topaz/i, { familySlug: 'topaz', publisher: 'Topaz Labs' }],
  [/^magnific/i, { familySlug: 'magnific', publisher: 'Freepik' }],
  [/^meshy/i, { familySlug: 'meshy', publisher: 'Meshy' }],
  [/^nano banana/i, { familySlug: 'nano-banana', publisher: 'Google' }],
  [/^pixverse/i, { familySlug: 'pixverse', publisher: 'PixVerse' }],
  [/^rodin/i, { familySlug: 'rodin', publisher: 'Hyper3D' }],
  [/^wavespeed/i, { familySlug: 'wavespeed', publisher: 'WaveSpeedAI' }],
  [/^vidu/i, { familySlug: 'vidu', publisher: 'ShengShu' }],
  [/^tripo/i, { familySlug: 'tripo', publisher: 'Tripo AI' }],
  [/^sam3/i, { familySlug: 'sam-3', publisher: 'Meta' }],
  [/^trellis/i, { familySlug: 'trellis', publisher: 'Microsoft Research' }],
  [/^pixal3d/i, { familySlug: 'pixal3d', publisher: 'Community' }],
  [/^mage flow/i, { familySlug: 'mage-flow', publisher: 'Community' }]
]

const partnerReleasePatterns: readonly [RegExp, string][] = [
  [/seedream\s*5\.0 pro/i, 'Seedream 5.0 Pro'],
  [/seedream\s*5\.0 lite/i, 'Seedream 5.0 Lite'],
  [/seedream\s*4\.0/i, 'Seedream 4.0'],
  [/seed audio\s*1\.0/i, 'Seed Audio 1.0'],
  [/seedance\s*1\.5 pro/i, 'Seedance 1.5 Pro'],
  [/seedance\s*1\.0 pro/i, 'Seedance 1.0 Pro'],
  [/seed\s*2\.0/i, 'Seed 2.0'],
  [/bytedance vcube/i, 'ByteDance vCube'],
  [/kling\s*3\.0/i, 'Kling 3.0'],
  [/kling\s*o3/i, 'Kling O3'],
  [/kling\s*o1/i, 'Kling O1'],
  [/kling\s*2\.6/i, 'Kling 2.6'],
  [/grok imagine image\s*2\.0/i, 'Grok Imagine Image 2.0'],
  [/grok imagine video\s*1\.5/i, 'Grok Imagine Video 1.5'],
  [/grok imagine image quality/i, 'Grok Imagine Image Quality'],
  [/gpt[ -]image\s*2/i, 'GPT Image 2'],
  [/gpt[ -]image[ -]1/i, 'GPT Image 1'],
  [/dall[ -]e\s*2/i, 'DALL-E 2'],
  [/dall[ -]e\s*3/i, 'DALL-E 3'],
  [/tripo\s*p1/i, 'Tripo P1'],
  [/tripo\s*h3\.1/i, 'Tripo H3.1'],
  [/tripo\s*3\.0/i, 'Tripo 3.0'],
  [/vidu\s*q3/i, 'Vidu Q3'],
  [/vidu\s*q2/i, 'Vidu Q2'],
  [/vidu\s*q1/i, 'Vidu Q1'],
  [/wan\s*2\.7/i, 'Wan 2.7'],
  [/wan\s*2\.6/i, 'Wan 2.6'],
  [/wan\s*2\.5/i, 'Wan 2.5'],
  [/flux\s*3 video/i, 'FLUX 3 Video'],
  [/flux[.]?2 \[max\]/i, 'FLUX.2 Max'],
  [/flux[.]?1 kontext/i, 'FLUX.1 Kontext'],
  [/flux[.]?1 \[pro\]/i, 'FLUX.1 Pro'],
  [/luma ray\s*3\.2/i, 'Luma Ray 3.2'],
  [/luma uni-?1/i, 'Luma UNI-1'],
  [/luma photon/i, 'Luma Photon'],
  [/gemini omni flash/i, 'Gemini Omni Flash'],
  [/nano banana\s*2 lite/i, 'Nano Banana 2 Lite'],
  [/nano banana\s*2/i, 'Nano Banana 2'],
  [/recraft\s*4\.1/i, 'Recraft 4.1'],
  [/recraft\s*v?4/i, 'Recraft 4'],
  [/topaz.*wonder\s*3\.5/i, 'Topaz Wonder 3.5'],
  [/topaz.*bloom\s*2/i, 'Topaz Bloom 2'],
  [/topaz astra\s*2/i, 'Topaz Astra 2'],
  [/topaz astra/i, 'Topaz Astra'],
  [/topaz.*starlight precise\s*2\.5/i, 'Topaz Starlight Precise 2.5'],
  [/runway aleph\s*2/i, 'Runway Aleph 2'],
  [/gen\s*4 turbo/i, 'Runway Gen-4 Turbo'],
  [/meshy\s*6/i, 'Meshy 6'],
  [/nano banana pro/i, 'Nano Banana Pro'],
  [/ideogram p-image/i, 'Ideogram P-Image'],
  [/ideogram v4/i, 'Ideogram 4'],
  [/rodin.*gen-?2/i, 'Rodin Gen-2'],
  [/veo\s*2/i, 'Veo 2']
]

const reservedReleaseSlugs = new Set(['wan-2-6'])

const primaryDirectories = new Set<ModelDirectory>([
  'diffusion_models',
  'checkpoints'
])

const roleByDirectory: Readonly<Record<ModelDirectory, ModelComponentRole>> = {
  diffusion_models: 'primary',
  checkpoints: 'primary',
  loras: 'adapter',
  controlnet: 'control',
  clip_vision: 'encoder',
  text_encoders: 'encoder',
  audio_encoders: 'encoder',
  vae: 'decoder',
  latent_upscale_models: 'upscaler',
  upscale_models: 'upscaler',
  model_patches: 'utility',
  style_models: 'adapter',
  geometry_estimation: 'utility',
  background_removal: 'utility',
  detection: 'utility',
  frame_interpolation: 'utility',
  optical_flow: 'utility',
  partner_nodes: 'partner'
}

const roleOrder: Readonly<Record<ModelComponentRole, number>> = {
  primary: 0,
  partner: 0,
  adapter: 1,
  control: 2,
  encoder: 3,
  decoder: 4,
  upscaler: 5,
  utility: 6
}

function repositoryOwner(url: string): string | undefined {
  try {
    return new URL(url).pathname.split('/').filter(Boolean)[0]
  } catch {
    return undefined
  }
}

function familyIdentity(model: Model): FamilyIdentity {
  const owner = repositoryOwner(model.huggingFaceUrl)
  return (
    familyPatterns.find(([pattern]) =>
      pattern.test(model.displayName)
    )?.[1] ?? {
      familySlug: model.hubSlug ?? model.slug,
      publisher: owner && owner !== 'Comfy-Org' ? owner : 'Community'
    }
  )
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z\d]+/g, '-')
    .replace(/^-|-$/g, '')
}

function releaseSlug(familySlug: string, displayName: string): string {
  const nameSlug = slugify(displayName)
  return nameSlug.includes(familySlug) ? nameSlug : `${familySlug}-${nameSlug}`
}

function partnerReleaseSlug(familySlug: string, displayName: string): string {
  const slug = releaseSlug(familySlug, displayName)
  return reservedReleaseSlugs.has(slug) ? `${slug}-api` : slug
}

function partnerReleaseName(
  model: Model,
  workflow: ModelWorkflowPreview
): string {
  const normalizedTitle = workflow.title.trim().replace(/\s+/g, ' ')
  const patternName = partnerReleasePatterns.find(([pattern]) =>
    pattern.test(normalizedTitle)
  )?.[1]
  if (patternName) return patternName
  return model.displayName
}

function partnerReleaseIdentity(
  provider: Model,
  displayName: string
): FamilyIdentity {
  return (
    familyPatterns.find(([pattern]) => pattern.test(displayName))?.[1] ??
    familyIdentity(provider)
  )
}

function workflowSignature(model: Model): string {
  return model.workflowPreviews
    .map(({ id }) => id)
    .sort()
    .join('|')
}

function releaseIdentityKey(model: Model): string {
  return `${familyIdentity(model).familySlug}:${slugify(
    releaseDisplayName(model.displayName)
  )}`
}

function releaseGroupKey(
  model: Model,
  identityCounts: ReadonlyMap<string, number>
): string {
  const identityKey = releaseIdentityKey(model)
  if ((identityCounts.get(identityKey) ?? 0) > 1) return identityKey
  const signature = workflowSignature(model)
  return signature
    ? `${familyIdentity(model).familySlug}:${signature}`
    : model.slug
}

function releaseDisplayName(name: string): string {
  return name
    .replace(/\b(high|low) noise\b/gi, '')
    .replace(/\b(global|local)\b/gi, '')
    .replace(/\bunconditional\b/gi, '')
    .replace(/\bpass\s*[12]\b/gi, '')
    .replace(/\b(fp|bf|int)\d+(?:\s+e\d+m\d+fn)?(?:\s+scaled)?\b/gi, '')
    .replace(/\bconvrot\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function componentFormat(model: Model): string | undefined {
  const quantization = model.name.match(
    /(?:^|[_-])((?:fp|bf|int)\d+(?:[_-]e\d+m\d+fn)?(?:[_-]scaled)?)(?:[_.-]|$)/i
  )?.[1]
  if (quantization) return quantization.replaceAll('_', ' ').toUpperCase()
  return model.name.match(/\.([a-z\d]+)$/i)?.[1]?.toUpperCase()
}

function toComponent(model: Model): ModelReleaseComponent {
  const format = componentFormat(model)
  return {
    slug: model.slug,
    displayName: model.displayName,
    role: roleByDirectory[model.directory],
    directory: model.directory,
    ...(format ? { format } : {}),
    downloadUrl: model.huggingFaceUrl
  }
}

function uniqueWorkflows(models: readonly Model[]): ModelWorkflowPreview[] {
  const workflows = new Map<string, ModelWorkflowPreview>()
  for (const model of models) {
    for (const workflow of model.workflowPreviews) {
      if (!workflows.has(workflow.id)) workflows.set(workflow.id, workflow)
    }
  }
  return [...workflows.values()].sort((a, b) =>
    (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '')
  )
}

function latestReleaseDate(
  workflows: readonly ModelWorkflowPreview[]
): string | undefined {
  return workflows.find(({ publishedAt }) => publishedAt)?.publishedAt
}

export function createModelReleases(catalog: readonly Model[]): ModelRelease[] {
  const canonicalModels = catalog.filter(({ canonicalSlug }) => !canonicalSlug)
  const localComponents = canonicalModels.filter(
    ({ directory }) => directory !== 'partner_nodes'
  )
  const primaryGroups = new Map<string, Model[]>()
  const primaryModels = localComponents.filter(({ directory }) =>
    primaryDirectories.has(directory)
  )
  const identityCounts = new Map<string, number>()
  for (const model of primaryModels) {
    const identityKey = releaseIdentityKey(model)
    identityCounts.set(identityKey, (identityCounts.get(identityKey) ?? 0) + 1)
  }

  for (const model of primaryModels) {
    const key = releaseGroupKey(model, identityCounts)
    primaryGroups.set(key, [...(primaryGroups.get(key) ?? []), model])
  }

  const localReleases = [...primaryGroups.values()].map((primaryModels) => {
    const primary = primaryModels[0]
    const identity = familyIdentity(primary)
    const workflows = uniqueWorkflows(primaryModels)
    const workflowIds = new Set(workflows.map(({ id }) => id))
    const primarySlugs = new Set(primaryModels.map(({ slug }) => slug))
    const components = localComponents.filter(
      (model) =>
        primarySlugs.has(model.slug) ||
        (!primaryDirectories.has(model.directory) &&
          model.workflowPreviews.some(({ id }) => workflowIds.has(id)))
    )
    const groupedSlug = releaseSlug(
      identity.familySlug,
      releaseDisplayName(primary.displayName)
    )
    const slug = primaryModels.length === 1 ? primary.slug : groupedSlug

    return {
      slug,
      familySlug: identity.familySlug,
      displayName: releaseDisplayName(primary.displayName),
      publisher: identity.publisher,
      access: 'open' as const,
      ...(latestReleaseDate(workflows)
        ? { releaseDate: latestReleaseDate(workflows) }
        : {}),
      categories: [
        ...new Set(primaryModels.flatMap(({ categories }) => categories))
      ],
      workflows,
      components: components
        .map(toComponent)
        .sort((a, b) => roleOrder[a.role] - roleOrder[b.role]),
      ...(workflows[0]?.thumbnailUrl
        ? { thumbnailUrl: workflows[0].thumbnailUrl }
        : {})
    }
  })

  const partnerReleases = canonicalModels
    .filter(({ directory }) => directory === 'partner_nodes')
    .flatMap((model) => {
      const groups = new Map<string, ModelWorkflowPreview[]>()
      for (const workflow of model.workflowPreviews) {
        const name = partnerReleaseName(model, workflow)
        groups.set(name, [...(groups.get(name) ?? []), workflow])
      }
      if (groups.size === 0) groups.set(model.displayName, [])

      return [...groups.entries()].map(([displayName, groupedWorkflows]) => {
        const identity = partnerReleaseIdentity(model, displayName)
        const workflows = uniqueWorkflows([
          { ...model, workflowPreviews: groupedWorkflows }
        ])
        const slug = partnerReleaseSlug(identity.familySlug, displayName)
        const categories = deriveModelCategories('', [
          ...workflows.map(({ title }) => title),
          ...workflows.map(({ id }) => id)
        ])
        return {
          slug,
          familySlug: identity.familySlug,
          displayName,
          publisher: identity.publisher,
          access: 'partner' as const,
          ...(latestReleaseDate(workflows)
            ? { releaseDate: latestReleaseDate(workflows) }
            : {}),
          categories: categories.length > 0 ? categories : model.categories,
          workflows,
          components: [toComponent(model)],
          ...(workflows[0]?.thumbnailUrl
            ? { thumbnailUrl: workflows[0].thumbnailUrl }
            : {})
        }
      })
    })

  return [...partnerReleases, ...localReleases].sort((a, b) =>
    (b.releaseDate ?? '').localeCompare(a.releaseDate ?? '')
  )
}

export function getModelReleaseBySlug(
  releases: readonly ModelRelease[],
  slug: string
): ModelRelease | undefined {
  return releases.find((release) => release.slug === slug)
}
