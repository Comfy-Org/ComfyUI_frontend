import { defineConfig } from 'astro/config'
import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'
import vue from '@astrojs/vue'
import tailwindcss from '@tailwindcss/vite'
import vercel from '@astrojs/vercel'

import { DEFAULT_LOCALE, LOCALES } from './src/i18n/locales'

// The preview deployment (PREVIEW_MODE=true) builds always-SSR so it can fetch
// authenticated CMS drafts; production stays a static build. See build-spec Part B.
const IS_PREVIEW = process.env.PREVIEW_MODE === 'true'

const PAYMENT_STATUSES = ['success', 'failed'] as const
const LOCALE_PREFIXES = LOCALES.map((locale) =>
  locale === DEFAULT_LOCALE ? '' : `/${locale}`
)
const SITEMAP_EXCLUDED_PATHNAMES = new Set([
  ...LOCALE_PREFIXES.flatMap((prefix) =>
    PAYMENT_STATUSES.map((status) => `${prefix}/payment/${status}`)
  ),
  ...LOCALE_PREFIXES.map((prefix) => `${prefix}/individual-submission`),
  ...LOCALE_PREFIXES.map((prefix) => `${prefix}/booking-confirmation`)
])

function isExcludedFromSitemap(page: string): boolean {
  const pathname = new URL(page).pathname.replace(/\/$/, '')
  return SITEMAP_EXCLUDED_PATHNAMES.has(pathname)
}

export default defineConfig({
  site: 'https://comfy.org',
  output: IS_PREVIEW ? 'server' : 'static',
  adapter: IS_PREVIEW ? vercel() : undefined,
  prefetch: { prefetchAll: true },
  // Keep MDX punctuation verbatim; SmartyPants would turn the source's straight
  // quotes into curly ones and drift from the rest of the site's copy.
  markdown: { smartypants: false },
  redirects: {
    '/cloud/enterprise-case-studies/comfyui-at-architectural-scale-how-moment-factory-reimagined-3d-projection-mapping':
      '/customers/moment-factory/',
    '/cloud/enterprise-case-studies/how-series-entertainment-rebuilt-game-and-video-production-with-comfyui':
      '/customers/series-entertainment/',
    '/zh-CN/terms-of-service': '/terms-of-service'
  },
  build: {
    assets: '_website'
  },
  devToolbar: { enabled: !process.env.NO_TOOLBAR },
  integrations: [
    vue(),
    mdx(),
    sitemap({
      filter: (page) => !isExcludedFromSitemap(page)
    })
  ],
  vite: {
    plugins: [tailwindcss()],
    server: {
      watch: {
        ignored: ['**/playwright-report/**']
      }
    }
  },
  i18n: {
    locales: [...LOCALES],
    defaultLocale: DEFAULT_LOCALE,
    routing: {
      prefixDefaultLocale: false
    }
  }
})
