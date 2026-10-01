import type { TranslationKey } from '../../../i18n/translations'

export interface ModelVersionRelease {
  readonly versionId: string
  readonly name: string
  readonly descriptionKey: TranslationKey
  readonly releasedAt: string
  readonly sourceUrl: string
  readonly identitySourceUrl: string
  readonly verifiedAt: string
  readonly href: string
  readonly access: 'open-weights' | 'partner-api'
  readonly modality: 'image' | 'video'
  readonly catalogSlug?: string
  readonly variantSlugs: readonly string[]
  readonly mediaSrc: string
}

export const modelVersionReleases: readonly ModelVersionRelease[] = [
  {
    versionId: 'Qwen/Qwen-Image-2.1',
    descriptionKey: 'models.explore.version.qwen21',
    name: 'Qwen Image 2.1',
    releasedAt: '2026-09-20',
    sourceUrl: 'https://qwen.ai/blog?id=qwen-image-2.1',
    identitySourceUrl: 'https://huggingface.co/Qwen/Qwen-Image-2.1',
    verifiedAt: '2026-10-01',
    href: '/p/supported-models/qwen-image-2-1-int8-convrot/',
    access: 'open-weights',
    modality: 'image',
    catalogSlug: 'qwen-image-2-1-int8-convrot',
    variantSlugs: ['qwen-image-2-1-int8-convrot'],
    mediaSrc:
      'https://raw.githubusercontent.com/Comfy-Org/workflow_templates/main/templates/image_qwen_image_2_1_background_removal-1.webp'
  },
  {
    versionId: 'byteplus/dreamina-seedance-2-5-260628',
    descriptionKey: 'models.explore.version.seedance25',
    name: 'Seedance 2.5',
    releasedAt: '2026-07-31',
    sourceUrl:
      'https://seed.bytedance.com/en/blog/one-take-creation-flexible-referencing-introducing-seedance-2-5',
    identitySourceUrl: 'https://seed.bytedance.com/seedance2_5',
    verifiedAt: '2026-10-01',
    href: '/hub/models/seedance-2-5-text-to-video/',
    access: 'partner-api',
    modality: 'video',
    variantSlugs: [],
    mediaSrc:
      'https://raw.githubusercontent.com/Comfy-Org/workflow_templates/main/templates/api_seedance2_5_video_editing-1.webp'
  },
  {
    versionId: 'byteplus/seedream-5-0-pro-260628',
    descriptionKey: 'models.explore.version.seedreamPro',
    name: 'Seedream 5.0 Pro',
    releasedAt: '2026-07-08',
    sourceUrl:
      'https://seed.bytedance.com/en/blog/beyond-generation-it-understands-design-introducing-seedream-5-0-pro',
    identitySourceUrl:
      'https://docs.byteplus.com/en/docs/modelark/seedream-4-0-5-0',
    verifiedAt: '2026-10-01',
    href: '/hub/models/seedream-5-0-pro-text-to-image/',
    access: 'partner-api',
    modality: 'image',
    variantSlugs: [],
    mediaSrc:
      'https://media.comfy.org/website/workshop/byteplus/seedream-5-pro/editorial-fashion-portrait.png'
  },
  {
    versionId: 'gemini-3.1-flash-image',
    descriptionKey: 'models.explore.version.nanoBanana2',
    name: 'Nano Banana 2 (Gemini 3.1 Flash Image)',
    releasedAt: '2026-02-26',
    sourceUrl:
      'https://blog.google/innovation-and-ai/technology/ai/nano-banana-2/',
    identitySourceUrl:
      'https://blog.google/innovation-and-ai/technology/developers-tools/build-with-nano-banana-2/',
    verifiedAt: '2026-10-01',
    href: '/hub/models/nano-banana-2-text-to-image/',
    access: 'partner-api',
    modality: 'image',
    variantSlugs: [],
    mediaSrc:
      'https://media.comfy.org/website/workshop/vertexai/gemini-nano-banana-2/helical-staircase-from-above.png'
  }
]

export function latestVerifiedModelVersions(
  releases: readonly ModelVersionRelease[] = modelVersionReleases,
  asOf: string = new Date().toISOString().slice(0, 10),
  limit = 4
): ModelVersionRelease[] {
  const versions = new Map<string, ModelVersionRelease>()
  for (const release of releases) {
    if (release.releasedAt <= asOf && !versions.has(release.versionId))
      versions.set(release.versionId, release)
  }
  return [...versions.values()]
    .sort((a, b) => b.releasedAt.localeCompare(a.releasedAt))
    .slice(0, Math.max(0, limit))
}
