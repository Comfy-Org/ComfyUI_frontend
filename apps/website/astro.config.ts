import { defineConfig } from 'astro/config'
import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'
import vue from '@astrojs/vue'
import tailwindcss from '@tailwindcss/vite'
import { isExcludedFromSitemap } from './src/config/indexing'
import { redirects } from './src/config/redirects'
import { markdownTwins } from './src/integrations/markdown-twins'
import { workshopReleaseGate } from './src/integrations/workshop-release-gate'
import { sitemapAlternates } from './src/lib/hreflang'

const LOCALES = ['en', 'zh-CN', 'ja'] as const
const DEFAULT_LOCALE = 'en'

export default defineConfig({
  site: 'https://comfy.org',
  output: 'static',
  prefetch: { prefetchAll: true },
  // Astro 7 changed the compressHTML default to JSX-style whitespace stripping.
  // Keep the v6 HTML-aware behavior so inline spacing across the site is unchanged.
  compressHTML: true,
  // Keep MDX punctuation verbatim; SmartyPants would turn the source's straight
  // quotes into curly ones and drift from the rest of the site's copy.
  markdown: { smartypants: false },
  redirects,
  build: {
    assets: '_website'
  },
  devToolbar: { enabled: !process.env.NO_TOOLBAR },
  integrations: [
    vue(),
    mdx(),
    sitemap({
      filter: (page) => !isExcludedFromSitemap(page),
      serialize: (item) => ({ ...item, links: sitemapAlternates(item.url) })
    }),
    markdownTwins(),
    workshopReleaseGate()
  ],
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      // Prebundle dependencies reached through Astro islands and lazy viewers
      // so late discovery does not invalidate their module URLs during dev.
      include: [
        'leaflet',
        'axios',
        '@comfyorg/litegraph',
        'shiki/core',
        'shiki/engine/javascript',
        'shiki/langs/javascript.mjs',
        'shiki/langs/json.mjs',
        'shiki/langs/python.mjs',
        'shiki/langs/shellscript.mjs',
        'shiki/langs/typescript.mjs',
        'shiki/themes/everforest-dark.mjs'
      ]
    },
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
