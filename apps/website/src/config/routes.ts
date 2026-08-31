import type { Locale } from '../i18n/translations'

const baseRoutes = {
  home: '/',
  download: '/download',
  cloud: '/cloud',
  cloudPricing: '/cloud/pricing',
  cloudEnterprise: '/cloud/enterprise',
  api: '/api',
  gallery: '/gallery',
  launches: '/launches',
  events: '/events',
  about: '/about',
  careers: '/careers',
  customers: '/customers',
  demos: '/demos',
  learning: '/learning',
  termsOfService: '/terms-of-service',
  enterpriseMsa: '/enterprise-msa',
  privacyPolicy: '/privacy-policy',
  affiliates: '/affiliates',
  affiliateTerms: '/affiliates/terms',
  contact: '/contact',
  models: '/p/supported-models',
  modelsShowcase: '/models',
  mcp: '/mcp',
  cli: '/cli',
  minimax: '/minimax-h3',
  minimaxMusic3: '/minimax-music-3',
  minimaxLicense: '/minimax/license',
  flux3: '/flux-3',
  seedance: '/seedance-2.5',
  fdct: '/forward-deployed-creatives',
  ltx: '/ltx-2.5',
  geminiOmni: '/gemini-omni',
  wanAnimate2: '/wan-animate-2',
  wan3: '/wan-3.0',
  brand: '/brand'
} as const

type Routes = typeof baseRoutes

// Routes that are served only at their canonical path regardless of the
// active locale. Localized variants of these routes intentionally do not
// exist, so getRoutes(<non-en>) must not prefix them — emitting
// /zh-CN/<route> would produce a dead link.
//
// affiliateTerms: legal-reviewed English-only document. See the comment
// header in src/pages/affiliates/terms.astro and the affiliate-terms i18n
// block in src/i18n/translations.ts for the reasoning.
//
// termsOfService: legal-reviewed English-only document, same reasoning.
//
// enterpriseMsa: legal-reviewed English-only document (Comfy Enterprise
// Customer Agreement template), same reasoning. See the comment header
// in src/pages/enterprise-msa.astro.
//
// models: the supported-models catalog only exists at /p/supported-models;
// there is no /<locale>/p/supported-models page, so a prefixed link 404s.
const LOCALE_INVARIANT_ROUTE_KEYS = new Set<keyof Routes>([
  'affiliates',
  'affiliateTerms',
  'termsOfService',
  'enterpriseMsa',
  'models'
])

const LOCALE_INVARIANT_PATHS = new Set<string>(
  [...LOCALE_INVARIANT_ROUTE_KEYS].map((key) => baseRoutes[key])
)

/**
 * Prefix an internal path with the locale (`/mcp` → `/zh-CN/mcp`). External
 * URLs and locale-invariant routes pass through unchanged.
 */
export function localizeHref(href: string, locale: Locale = 'en'): string {
  if (locale === 'en' || !href.startsWith('/')) return href
  if (LOCALE_INVARIANT_PATHS.has(href)) return href
  return `/${locale}${href}`
}

export function getRoutes(locale: Locale = 'en'): Routes {
  if (locale === 'en') return baseRoutes
  return Object.fromEntries(
    Object.entries(baseRoutes).map(([key, path]) => [
      key,
      localizeHref(path, locale)
    ])
  ) as unknown as Routes
}

export const externalLinks = {
  affiliateApplicationForm: 'https://forms.gle/RS8L2ttcuGap4Q1v6',
  apiKeys: 'https://platform.comfy.org/profile/api-keys',
  blog: 'https://blog.comfy.org/',
  cloud: 'https://cloud.comfy.org',
  cloudCta: (content: string) =>
    `https://cloud.comfy.org/?utm_source=comfy_org&utm_medium=website&utm_campaign=free_tier&utm_content=${content}`,
  cloudStatus: 'https://status.comfy.org',
  discord: 'https://discord.com/invite/comfyorg',
  docs: 'https://docs.comfy.org/',
  docsApi: 'https://docs.comfy.org/development/cloud/overview#quick-start',
  comfyCliRepo: 'https://github.com/Comfy-Org/comfy-cli',
  comfyMcpRepo: 'https://github.com/Comfy-Org/comfy-mcp',
  docsCli: 'https://docs.comfy.org/agent-tools/cli',
  // Markdown variant handed to agents in the "ask your agent" cards, same
  // rationale as docsMcpMd below.
  docsCliMd: 'https://docs.comfy.org/agent-tools/cli.md',
  docsCliReference: 'https://docs.comfy.org/comfy-cli/reference',
  docsMcp: 'https://docs.comfy.org/agent-tools/mcp',
  docsMcpLocal:
    'https://docs.comfy.org/agent-tools/mcp#local-comfy-mcp-connection',
  // Markdown variants handed to agents in the "ask your agent" cards: agents
  // fetch the .md URL and get readable markdown instead of the HTML shell.
  docsMcpMd: 'https://docs.comfy.org/agent-tools/mcp.md',
  docsMcpLocalMd:
    'https://docs.comfy.org/agent-tools/mcp.md#local-comfy-mcp-connection',
  docsSdk: 'https://docs.comfy.org/development/api-development/sdks',
  docsSubscription: 'https://docs.comfy.org/support/subscription/subscribing',
  g2ComfyUi: 'https://www.g2.com/products/comfyui',
  github: 'https://github.com/Comfy-Org/ComfyUI',
  githubInstall: 'https://github.com/Comfy-Org/ComfyUI#installing',
  instagram: 'https://www.instagram.com/comfyui/',
  linkedin: 'https://www.linkedin.com/company/comfyui',
  mcpEndpoint: 'https://cloud.comfy.org/mcp',
  mcpSkills: 'https://github.com/Comfy-Org/comfy-skills',
  platform: 'https://platform.comfy.org',
  platformUsage: 'https://platform.comfy.org/profile/usage',
  reddit: 'https://www.reddit.com/r/comfyui/',
  support: 'https://support.comfy.org/hc/en-us',
  trustCenter: 'https://app.vanta.com/comfy.org/trust/o6nu46b16iu3e7fhc41hnz',
  wikidataComfyOrg: 'https://www.wikidata.org/wiki/Q130598554',
  wikidataComfyUi: 'https://www.wikidata.org/wiki/Q127798647',
  wikipediaComfyUi: 'https://en.wikipedia.org/wiki/ComfyUI',
  workflows: 'https://comfy.org/workflows',
  x: 'https://x.com/ComfyUI',
  youtube: 'https://www.youtube.com/@ComfyOrg'
} as const
