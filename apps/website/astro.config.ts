import { defineConfig } from 'astro/config'
import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'
import vue from '@astrojs/vue'
import tailwindcss from '@tailwindcss/vite'
import { isExcludedFromSitemap } from './src/config/indexing'
import { markdownTwins } from './src/integrations/markdown-twins'

const LOCALES = ['en', 'zh-CN'] as const
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
  redirects: {
    '/cloud/enterprise': { status: 301, destination: '/enterprise/' },
    '/zh-CN/cloud/enterprise': { status: 301, destination: '/enterprise/' },
    '/cloud/enterprise-case-studies/comfyui-at-architectural-scale-how-moment-factory-reimagined-3d-projection-mapping':
      '/customers/moment-factory/',
    '/cloud/enterprise-case-studies/how-series-entertainment-rebuilt-game-and-video-production-with-comfyui':
      '/customers/series-entertainment/',
    '/zh-CN/terms-of-service': '/terms-of-service/',
    '/minimax': { status: 307, destination: '/minimax-h3/' },
    '/zh-CN/minimax': { status: 307, destination: '/zh-CN/minimax-h3/' }
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
    }),
    markdownTwins()
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
