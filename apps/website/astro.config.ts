import { defineConfig } from 'astro/config'
import sitemap from '@astrojs/sitemap'
import vue from '@astrojs/vue'
import tailwindcss from '@tailwindcss/vite'

const LOCALES = ['en', 'zh-CN'] as const
const DEFAULT_LOCALE = 'en'
const PAYMENT_STATUSES = ['success', 'failed'] as const
const LOCALE_PREFIXES = LOCALES.map((locale) =>
  locale === DEFAULT_LOCALE ? '' : `/${locale}`
)
const NOINDEX_PATHNAMES = ['/affiliates']
const SITEMAP_EXCLUDED_PATHNAMES = new Set(
  LOCALE_PREFIXES.flatMap((prefix) => [
    ...PAYMENT_STATUSES.map((status) => `${prefix}/payment/${status}`),
    ...NOINDEX_PATHNAMES.map((path) => `${prefix}${path}`)
  ])
)

function isExcludedFromSitemap(page: string): boolean {
  const pathname = new URL(page).pathname.replace(/\/$/, '')
  return SITEMAP_EXCLUDED_PATHNAMES.has(pathname)
}

export default defineConfig({
  site: 'https://comfy.org',
  output: 'static',
  prefetch: { prefetchAll: true },
  redirects: {
    '/cloud/enterprise-case-studies/comfyui-at-architectural-scale-how-moment-factory-reimagined-3d-projection-mapping':
      '/customers/moment-factory/',
    '/cloud/enterprise-case-studies/how-series-entertainment-rebuilt-game-and-video-production-with-comfyui':
      '/customers/series-entertainment/'
  },
  build: {
    assets: '_website'
  },
  devToolbar: { enabled: !process.env.NO_TOOLBAR },
  integrations: [
    vue(),
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
