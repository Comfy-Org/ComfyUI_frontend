import { defineConfig } from 'astro/config'
import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'
import vue from '@astrojs/vue'
import vercel from '@astrojs/vercel'
import tailwindcss from '@tailwindcss/vite'
import { isExcludedFromSitemap, isIndexableBuild } from './src/config/indexing'
import { DEFAULT_LOCALE, LOCALE_CODES } from './src/config/locales'
import { astroRedirects } from './src/config/redirects'
import { indexNowManifest } from './src/integrations/indexnow-manifest'
import { markdownTwins } from './src/integrations/markdown-twins'
import { workshopReleaseGate } from './src/integrations/workshop-release-gate'
import { sitemapAlternates } from './src/lib/hreflang'

export default defineConfig({
  site: 'https://comfy.org',
  output: 'static',
  adapter: process.env.SITE_CATALOG_API_URL ? vercel() : undefined,
  security: {
    checkOrigin: true,
    allowedDomains: process.env.SITE_CATALOG_API_URL
      ? (process.env.SITE_CATALOG_WEBSITE_ORIGINS ?? '')
          .split(',')
          .filter(Boolean)
          .map((origin) => {
            const url = new URL(origin)
            return {
              hostname: url.hostname,
              protocol: url.protocol.slice(0, -1),
              port: url.port
            }
          })
      : []
  },
  server: {
    allowedHosts: process.env.SITE_CATALOG_PREVIEW_HOST
      ? [process.env.SITE_CATALOG_PREVIEW_HOST]
      : []
  },
  prefetch: { prefetchAll: true },
  // Astro 7 changed the compressHTML default to JSX-style whitespace stripping.
  // Keep the v6 HTML-aware behavior so inline spacing across the site is unchanged.
  compressHTML: true,
  // Keep MDX punctuation verbatim; SmartyPants would turn the source's straight
  // quotes into curly ones and drift from the rest of the site's copy.
  markdown: { smartypants: false },
  redirects: astroRedirects,
  build: {
    assets: '_website'
  },
  devToolbar: { enabled: !process.env.NO_TOOLBAR },
  integrations: [
    vue(),
    mdx(),
    sitemap({
      filter: (page) => !isExcludedFromSitemap(page),
      serialize: (item) =>
        isIndexableBuild()
          ? { ...item, links: sitemapAlternates(item.url) }
          : item
    }),
    markdownTwins(),
    indexNowManifest(),
    workshopReleaseGate()
  ],
  vite: {
    plugins: [tailwindcss()],
    define: {
      __VUE_I18N_LEGACY_API__: false,
      __VUE_I18N_FULL_INSTALL__: false,
      __INTLIFY_PROD_DEVTOOLS__: false
    },
    optimizeDeps: {
      // Leaflet only reaches the graph through a dynamic import inside an
      // island (MapPins01), which Vite's dep scanner does not walk. Without
      // this the dev server serves a stale pre-bundle URL and the map silently
      // fails to load.
      include: ['leaflet']
    },
    server: {
      watch: {
        ignored: ['**/playwright-report/**']
      }
    }
  },
  i18n: {
    locales: [...LOCALE_CODES],
    defaultLocale: DEFAULT_LOCALE,
    routing: {
      prefixDefaultLocale: false
    }
  }
})
