import { defineConfig } from 'astro/config'
import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'
import vue from '@astrojs/vue'
import tailwindcss from '@tailwindcss/vite'
import { isExcludedFromSitemap } from './src/config/indexing'
import { readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import {
  clusterAlternates,
  mirroredRoutes,
  unprefixed
} from './src/utils/hreflangRoutes'

const LOCALES = ['en', 'zh-CN'] as const
const DEFAULT_LOCALE = 'en'

/** Page files as `/src/pages/...` paths, the shape `mirroredRoutes` expects. */
function pageFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return pageFiles(full)
    if (!entry.name.endsWith('.astro')) return []
    const rel = relative(process.cwd(), full).split(sep).join('/')
    return [`/${rel}`]
  })
}

// The sitemap advertises the same cluster the pages do, from the same rule, so
// the two cannot disagree about which pages have a twin. Alternates on a URL
// whose twin does not exist would be the markup bug all over again, in a file
// search engines read first.
const MIRRORED_ROUTES = mirroredRoutes(
  pageFiles(join(process.cwd(), 'src', 'pages'))
)

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
    '/cloud/enterprise-case-studies/comfyui-at-architectural-scale-how-moment-factory-reimagined-3d-projection-mapping':
      '/customers/moment-factory/',
    '/cloud/enterprise-case-studies/how-series-entertainment-rebuilt-game-and-video-production-with-comfyui':
      '/customers/series-entertainment/',
    '/zh-CN/terms-of-service': '/terms-of-service/',
    // Affiliates exists in English only. Without these a reader who swaps the
    // locale prefix by hand gets a 404 instead of the page they asked for, which
    // is the same reason the line above exists.
    '/zh-CN/affiliates': '/affiliates',
    '/zh-CN/affiliates/terms': '/affiliates/terms',
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
      filter: (page) => !isExcludedFromSitemap(page),
      serialize(item) {
        const { origin, pathname } = new URL(item.url)
        const path = unprefixed(pathname)
        if (!MIRRORED_ROUTES.has(path)) return item

        // Rendered from the same builder the page tags use, so the sitemap
        // cannot describe a different cluster than the markup.
        item.links = clusterAlternates(path, origin).map((alternate) => ({
          lang: alternate.hreflang,
          url: alternate.href
        }))
        return item
      }
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
