import { TemplateIncludeOnDistributionEnum } from '../types/template'
import type {
  LogoInfo,
  TemplateInfo,
  WorkflowTemplates
} from '../types/template'
import type { HubWorkflowIndexEntry } from '../schemas/hubWorkflowIndexSchema'

const distributionValues = new Set(
  Object.values(TemplateIncludeOnDistributionEnum)
)

function getPreviewExtension(url?: string): string | undefined {
  if (!url) return undefined

  try {
    const { pathname } = new URL(url)
    const extension = pathname.split('.').pop()?.toLowerCase()
    return extension || undefined
  } catch {
    return undefined
  }
}

function getPreviewMediaType(
  thumbnailUrl?: string,
  mediaType?: string
): string | undefined {
  const extension = getPreviewExtension(thumbnailUrl)

  if (extension && ['mp4', 'webm', 'mov'].includes(extension)) {
    return 'video'
  }

  if (extension && ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(extension)) {
    return 'image'
  }

  return mediaType
}

function getPreviewMediaSubtype(
  thumbnailUrl?: string,
  mediaSubtype?: string
): string {
  return getPreviewExtension(thumbnailUrl) ?? mediaSubtype ?? 'webp'
}

function mapLogo(logo: Record<string, unknown>): LogoInfo | null {
  const provider = logo.provider

  if (
    typeof provider !== 'string' &&
    !(
      Array.isArray(provider) &&
      provider.length > 0 &&
      provider.every((value) => typeof value === 'string')
    )
  ) {
    return null
  }

  return {
    provider,
    ...(typeof logo.label === 'string' ? { label: logo.label } : {}),
    ...(typeof logo.gap === 'number' ? { gap: logo.gap } : {}),
    ...(typeof logo.position === 'string' ? { position: logo.position } : {}),
    ...(typeof logo.opacity === 'number' ? { opacity: logo.opacity } : {})
  }
}

function mapLogos(
  logos?: Array<Record<string, unknown>>
): LogoInfo[] | undefined {
  const mapped = logos?.map(mapLogo).filter((logo): logo is LogoInfo => !!logo)
  return mapped?.length ? mapped : undefined
}

function mapIncludeOnDistributions(
  includeOnDistributions?: string[]
): TemplateIncludeOnDistributionEnum[] | undefined {
  const mapped = includeOnDistributions?.filter(
    (value): value is TemplateIncludeOnDistributionEnum =>
      distributionValues.has(value as TemplateIncludeOnDistributionEnum)
  )
  return mapped?.length ? mapped : undefined
}

export function mapHubWorkflowIndexEntryToTemplate(
  entry: HubWorkflowIndexEntry
): TemplateInfo {
  return {
    name: entry.name,
    title: entry.title,
    description: entry.description ?? '',
    mediaType:
      getPreviewMediaType(entry.thumbnailUrl, entry.mediaType) ?? 'image',
    mediaSubtype: getPreviewMediaSubtype(
      entry.thumbnailUrl,
      entry.mediaSubtype
    ),
    thumbnailVariant: entry.thumbnailVariant,
    isEssential: entry.isEssential,
    shareId: entry.shareId,
    tags: entry.tags,
    models: entry.models,
    date: entry.date,
    useCase: entry.useCase,
    license: entry.license,
    vram: entry.vram,
    size: entry.size,
    openSource: entry.openSource,
    thumbnailUrl: entry.thumbnailUrl,
    thumbnailComparisonUrl: entry.thumbnailComparisonUrl,
    tutorialUrl: entry.tutorialUrl,
    requiresCustomNodes: entry.requiresCustomNodes,
    searchRank: entry.searchRank,
    usage: entry.usage,
    includeOnDistributions: mapIncludeOnDistributions(
      entry.includeOnDistributions
    ),
    logos: mapLogos(entry.logos)
  }
}

export function mapHubWorkflowIndexToCategories(
  entries: HubWorkflowIndexEntry[],
  title: string = 'All'
): WorkflowTemplates[] {
  return [
    {
      moduleName: 'default',
      title,
      templates: entries.map(mapHubWorkflowIndexEntryToTemplate)
    }
  ]
}
