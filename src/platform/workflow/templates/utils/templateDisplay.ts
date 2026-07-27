import type {
  LogoInfo,
  TemplateInfo,
  TemplateTypeFilter
} from '@/platform/workflow/templates/types/template'

export function isAppTemplate(template: TemplateInfo): boolean {
  return template.name.endsWith('.app')
}

export function filterTemplatesByType(
  templates: TemplateInfo[],
  type: TemplateTypeFilter
): TemplateInfo[] {
  if (type === 'all') return templates
  const wantApp = type === 'apps'
  return templates.filter((template) => isAppTemplate(template) === wantApp)
}

const iconFiles = import.meta.glob(
  '../../../../../packages/design-system/src/icons/*.svg',
  { query: '?raw' }
)

const AVAILABLE_ICON_SLUGS = new Set(
  Object.keys(iconFiles).map(
    (path) => path.split('/').pop()?.replace('.svg', '') ?? ''
  )
)

/** Provider names whose slug does not fall out of the name itself. */
const PROVIDER_ICON_ALIASES: Record<string, string> = {
  'black forest labs': 'bfl',
  google: 'gemini',
  lightricks: 'ltxv',
  stability: 'stability-ai'
}

function toSlug(provider: string): string {
  const normalized = provider.trim().toLowerCase()
  return (
    PROVIDER_ICON_ALIASES[normalized] ??
    normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  )
}

export function getProviderIconClass(provider: string): string | null {
  const slug = toSlug(provider)
  return AVAILABLE_ICON_SLUGS.has(slug) ? `icon-mask-[comfy--${slug}]` : null
}

export interface ProviderBadge {
  provider: string
  iconClass: string | null
  logoUrl: string
}

export interface ProviderBadges {
  visible: ProviderBadge[]
  extraProviders: string[]
}

/** Badges shown before the rest collapse into a "+N" chip. */
const MAX_VISIBLE_PROVIDERS = 5

export function getProviderBadges(
  logo: LogoInfo,
  getLogoUrl: (provider: string) => string
): ProviderBadges | null {
  const providers = Array.isArray(logo.provider)
    ? logo.provider
    : [logo.provider]
  const badges = providers
    .map((provider) => ({
      provider,
      iconClass: getProviderIconClass(provider),
      logoUrl: getLogoUrl(provider)
    }))
    .filter((badge) => badge.iconClass !== null || badge.logoUrl !== '')

  if (badges.length === 0) return null

  return {
    visible: badges.slice(0, MAX_VISIBLE_PROVIDERS),
    extraProviders: badges
      .slice(MAX_VISIBLE_PROVIDERS)
      .map((badge) => badge.provider)
  }
}

/** Tags shown before the rest collapse into a "+N" chip. */
const MAX_VISIBLE_TAGS = 2

export interface TemplateTags {
  visible: string[]
  hidden: string[]
}

export function getTemplateTags(template: TemplateInfo): TemplateTags {
  const tags = template.tags ?? []
  return {
    visible: tags.slice(0, MAX_VISIBLE_TAGS),
    hidden: tags.slice(MAX_VISIBLE_TAGS)
  }
}
