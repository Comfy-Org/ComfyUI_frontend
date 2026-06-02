import type { Locale } from '../i18n/translations'

const baseRoutes = {
  home: '/',
  download: '/download',
  cloud: '/cloud',
  cloudPricing: '/cloud/pricing',
  cloudEnterprise: '/cloud/enterprise',
  api: '/api',
  gallery: '/gallery',
  about: '/about',
  careers: '/careers',
  customers: '/customers',
  demos: '/demos',
  termsOfService: '/terms-of-service',
  privacyPolicy: '/privacy-policy',
  affiliates: '/affiliates',
  affiliateTerms: '/affiliates/terms',
  contact: '/contact',
  models: '/p/supported-models'
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
const LOCALE_INVARIANT_ROUTE_KEYS = new Set<keyof Routes>([
  'affiliates',
  'affiliateTerms',
  'termsOfService'
])

export function getRoutes(locale: Locale = 'en'): Routes {
  if (locale === 'en') return baseRoutes
  const prefix = `/${locale}`
  return Object.fromEntries(
    Object.entries(baseRoutes).map(([k, v]) => [
      k,
      LOCALE_INVARIANT_ROUTE_KEYS.has(k as keyof Routes) ? v : `${prefix}${v}`
    ])
  ) as unknown as Routes
}

export const externalLinks = {
  affiliateApplicationForm: 'https://forms.gle/RS8L2ttcuGap4Q1v6',
  apiKeys: 'https://platform.comfy.org/profile/api-keys',
  blog: 'https://blog.comfy.org/',
  cloud: 'https://cloud.comfy.org',
  cloudStatus: 'https://status.comfy.org',
  discord: 'https://discord.com/invite/comfyorg',
  docs: 'https://docs.comfy.org/',
  docsApi: 'https://docs.comfy.org/api-reference/cloud',
  docsSubscription: 'https://docs.comfy.org/support/subscription/subscribing',
  github: 'https://github.com/Comfy-Org/ComfyUI',
  githubInstall: 'https://github.com/Comfy-Org/ComfyUI#installing',
  platform: 'https://platform.comfy.org',
  platformUsage: 'https://platform.comfy.org/profile/usage',
  support: 'https://support.comfy.org/hc/en-us',
  workflows: 'https://comfy.org/workflows',
  youtube: 'https://www.youtube.com/@ComfyOrg'
} as const
