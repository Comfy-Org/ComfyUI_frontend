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
  affiliateTerms: '/affiliates/terms',
  contact: '/contact'
} as const

type Routes = typeof baseRoutes

export function getRoutes(locale: Locale = 'en'): Routes {
  if (locale === 'en') return baseRoutes
  const prefix = `/${locale}`
  return Object.fromEntries(
    Object.entries(baseRoutes).map(([k, v]) => [k, `${prefix}${v}`])
  ) as unknown as Routes
}

export const externalLinks = {
  apiKeys: 'https://platform.comfy.org/profile/api-keys',
  blog: 'https://blog.comfy.org/',
  cloud: 'https://cloud.comfy.org',
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
