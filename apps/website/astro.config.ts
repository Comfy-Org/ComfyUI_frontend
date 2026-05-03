import { defineConfig } from 'astro/config'
import sitemap from '@astrojs/sitemap'
import vue from '@astrojs/vue'
import tailwindcss from '@tailwindcss/vite'

const SITEMAP_EXCLUDED_PATHNAMES = new Set([
  '/payment/success',
  '/payment/failed',
  '/zh-CN/payment/success',
  '/zh-CN/payment/failed'
])

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
    locales: ['en', 'zh-CN'],
    defaultLocale: 'en',
    routing: {
      prefixDefaultLocale: false
    }
  }
})
