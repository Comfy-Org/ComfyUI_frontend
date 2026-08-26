import type { Model, ModelDirectory, ModelWorkflowPreview } from './models'
import type { ModelCategory } from './modelCategories'

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
  [/^seedance/i, { familySlug: 'seedance', publisher: 'ByteDance' }],
  [/^kling/i, { familySlug: 'kling', publisher: 'Kuaishou' }],
  [/^ideogram/i, { familySlug: 'ideogram', publisher: 'Ideogram' }],
  [/^ace[ -]?step/i, { familySlug: 'ace-step', publisher: 'ACE Studio' }],
  [/^gemini/i, { familySlug: 'gemini', publisher: 'Google' }],
  [/^grok/i, { familySlug: 'grok', publisher: 'xAI' }],
  [/^openai/i, { familySlug: 'openai', publisher: 'OpenAI' }],
  [/^runway/i, { familySlug: 'runway', publisher: 'Runway' }]
]

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

function familyIdentity(model: Model): FamilyIdentity {
  return (
    familyPatterns.find(([pattern]) =>
      pattern.test(model.displayName)
    )?.[1] ?? {
      familySlug: model.hubSlug ?? model.slug,
      publisher: model.displayName
    }
  )
}

function workflowSignature(model: Model): string {
  return model.workflowPreviews
    .map(({ id }) => id)
    .sort()
    .join('|')
}

function releaseGroupKey(model: Model): string {
  const signature = workflowSignature(model)
  return signature
    ? `${familyIdentity(model).familySlug}:${signature}`
    : model.slug
}

function releaseDisplayName(name: string): string {
  return name
    .replace(/\b(high|low) noise\b/gi, '')
    .replace(/\b(global|local)\b/gi, '')
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

  for (const model of localComponents.filter(({ directory }) =>
    primaryDirectories.has(directory)
  )) {
    const key = releaseGroupKey(model)
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
        model.workflowPreviews.some(({ id }) => workflowIds.has(id))
    )
    const slug =
      primaryModels.length === 1
        ? primary.slug
        : `${identity.familySlug}-${releaseDisplayName(primary.displayName)
            .toLowerCase()
            .replace(/[^a-z\d]+/g, '-')
            .replace(/^-|-$/g, '')}`

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
      components: components.map(toComponent),
      ...(workflows[0]?.thumbnailUrl
        ? { thumbnailUrl: workflows[0].thumbnailUrl }
        : {})
    }
  })

  const partnerReleases = canonicalModels
    .filter(({ directory }) => directory === 'partner_nodes')
    .map((model) => {
      const identity = familyIdentity(model)
      const workflows = uniqueWorkflows([model])
      return {
        slug: model.slug,
        familySlug: identity.familySlug,
        displayName: model.displayName,
        publisher: identity.publisher,
        access: 'partner' as const,
        ...(latestReleaseDate(workflows)
          ? { releaseDate: latestReleaseDate(workflows) }
          : {}),
        categories: model.categories,
        workflows,
        components: [toComponent(model)],
        ...(workflows[0]?.thumbnailUrl
          ? { thumbnailUrl: workflows[0].thumbnailUrl }
          : {})
      }
    })

  return [...partnerReleases, ...localReleases].sort((a, b) =>
    (b.releaseDate ?? '').localeCompare(a.releaseDate ?? '')
  )
}
