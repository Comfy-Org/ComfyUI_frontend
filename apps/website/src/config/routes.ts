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
  videos: '/videos',
  caseStudies: '/case-studies',
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
  cloud: 'https://cloud.comfy.org',
  workflows: 'https://comfy.org/workflows',
  blog: 'https://blog.comfy.org/',
  github: 'https://github.com/Comfy-Org/ComfyUI',
  discord: 'https://discord.com/invite/comfyorg',
  docs: 'https://docs.comfy.org/',
  youtube: 'https://www.youtube.com/@ComfyOrg'
} as const
