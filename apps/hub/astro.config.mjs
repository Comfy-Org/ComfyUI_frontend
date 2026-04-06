import { defineConfig } from 'astro/config'
import sitemap from '@astrojs/sitemap'
import vercel from '@astrojs/vercel'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

import vue from '@astrojs/vue'

// Build template date lookup at config time
const templatesDir = path.join(process.cwd(), 'src/content/templates')
const templateDates = new Map()

if (fs.existsSync(templatesDir)) {
  const files = fs.readdirSync(templatesDir).filter((f) => f.endsWith('.json'))
  for (const file of files) {
    try {
      const content = JSON.parse(
        fs.readFileSync(path.join(templatesDir, file), 'utf-8')
      )
      if (content.name && content.date) {
        templateDates.set(content.name, content.date)
      }
    } catch {
      // Skip invalid JSON files
    }
  }
}

// Build timestamp used as lastmod fallback for pages without a specific date
const buildDate = new Date().toISOString()

// Supported locales (matches src/i18n/config.ts)
const locales = [
  'en',
  'zh',
  'zh-TW',
  'ja',
  'ko',
  'es',
  'fr',
  'ru',
  'tr',
  'ar',
  'pt-BR'
]
const nonDefaultLocales = locales.filter((l) => l !== 'en')

// Custom sitemap pages for ISR routes not discovered at build time
const siteOrigin = (
  process.env.PUBLIC_SITE_ORIGIN || 'https://www.comfy.org'
).replace(/\/$/, '')

// Creator profile pages — extract unique usernames from synced templates
const creatorUsernames = new Set()
if (fs.existsSync(templatesDir)) {
  const files = fs.readdirSync(templatesDir).filter((f) => f.endsWith('.json'))
  for (const file of files) {
    try {
      const content = JSON.parse(
        fs.readFileSync(path.join(templatesDir, file), 'utf-8')
      )
      if (content.username) creatorUsernames.add(content.username)
    } catch {
      // Skip invalid JSON
    }
  }
}

const creatorPages = [...creatorUsernames].map(
  (u) => `${siteOrigin}/workflows/${u}/`
)
const localeCustomPages = nonDefaultLocales.map(
  (locale) => `${siteOrigin}/${locale}/workflows/`
)
const customPages = [...creatorPages, ...localeCustomPages]

// https://astro.build/config
export default defineConfig({
  site: (process.env.PUBLIC_SITE_ORIGIN || 'https://www.comfy.org').replace(
    /\/$/,
    ''
  ),
  prefetch: {
    prefetchAll: false,
    defaultStrategy: 'hover'
  },
  i18n: {
    defaultLocale: 'en',
    locales: locales,
    routing: {
      prefixDefaultLocale: false // English at root, others prefixed (/zh/, /ja/, etc.)
    }
  },
  integrations: [
    sitemap({
      // Use custom filename to avoid collision with Framer's /sitemap.xml
      filenameBase: 'sitemap-workflows',
      // Include Framer's marketing sitemap in the index
      customSitemaps: ['https://www.comfy.org/sitemap.xml'],
      // Include on-demand locale pages that aren't discovered at build time
      customPages: customPages,
      serialize(item) {
        const url = new URL(item.url)
        const pathname = url.pathname

        // Template detail pages: /workflows/{slug}/ or /{locale}/workflows/{slug}/
        const templateMatch = pathname.match(
          /^(?:\/([a-z]{2}(?:-[A-Z]{2})?))?\/workflows\/([^/]+)\/?$/
        )
        if (templateMatch) {
          const slug = templateMatch[2]
          const date = templateDates.get(slug)
          item.lastmod = date ? new Date(date).toISOString() : buildDate
          // @ts-expect-error - sitemap types are stricter than actual API
          item.changefreq = 'monthly'
          item.priority = 0.8
          return item
        }

        // Homepage
        if (pathname === '/' || pathname === '') {
          item.lastmod = buildDate
          // @ts-expect-error - sitemap types are stricter than actual API
          item.changefreq = 'daily'
          item.priority = 1.0
          return item
        }

        // Workflows index (including localized versions)
        if (pathname.match(/^(?:\/[a-z]{2}(?:-[A-Z]{2})?)?\/workflows\/?$/)) {
          item.lastmod = buildDate
          // @ts-expect-error - sitemap types are stricter than actual API
          item.changefreq = 'daily'
          item.priority = 0.9
          return item
        }

        // Category pages: /workflows/category/{type}/ or /{locale}/workflows/category/{type}/
        if (
          pathname.match(
            /^(?:\/[a-z]{2}(?:-[A-Z]{2})?)?\/workflows\/category\//
          )
        ) {
          // @ts-expect-error - sitemap types are stricter than actual API
          item.changefreq = 'weekly'
          item.priority = 0.7
          return item
        }

        // Model pages: /workflows/model/{model}/ or /{locale}/workflows/model/{model}/
        if (
          pathname.match(/^(?:\/[a-z]{2}(?:-[A-Z]{2})?)?\/workflows\/model\//)
        ) {
          // @ts-expect-error - sitemap types are stricter than actual API
          item.changefreq = 'weekly'
          item.priority = 0.6
          return item
        }

        // Tag pages: /workflows/tag/{tag}/ or /{locale}/workflows/tag/{tag}/
        if (
          pathname.match(/^(?:\/[a-z]{2}(?:-[A-Z]{2})?)?\/workflows\/tag\//)
        ) {
          // @ts-expect-error - sitemap types are stricter than actual API
          item.changefreq = 'weekly'
          item.priority = 0.6
          return item
        }

        // Default for other pages
        // @ts-expect-error - sitemap types are stricter than actual API
        item.changefreq = 'weekly'
        item.priority = 0.5
        return item
      },
      // Exclude OG image routes and legacy redirect pages from sitemap.
      // Legacy redirects are /workflows/{slug}/ without a 12-char hex share_id suffix.
      // Canonical detail pages are /workflows/{slug}-{shareId}/ (shareId = 12 hex chars).
      filter: (page) => {
        if (
          page.includes('/workflows/og/') ||
          page.includes('/workflows/og.png')
        )
          return false
        // Check if this is a workflow detail path (not category/tag/model/creators)
        const match = page.match(/\/workflows\/([^/]+)\/$/)
        if (match) {
          const segment = match[1]
          // Skip known sub-paths
          if (
            ['category', 'tag', 'model', 'creators'].some((p) =>
              page.includes(`/workflows/${p}/`)
            )
          )
            return true
          // Include if it has a share_id suffix (12 hex chars after last hyphen)
          const lastHyphen = segment.lastIndexOf('-')
          if (lastHyphen === -1) return false // No hyphen = legacy redirect
          const candidate = segment.slice(lastHyphen + 1)
          if (candidate.length === 12 && /^[0-9a-f]+$/.test(candidate))
            return true
          return false // Has hyphen but not a valid share_id = legacy redirect
        }
        return true
      }
    }),
    vue()
  ],
  output: 'static',
  adapter: vercel({
    webAnalytics: { enabled: true },
    skewProtection: true
  }),

  // Build performance optimizations
  build: {
    // Increase concurrency for faster builds on multi-core systems
    concurrency: Math.max(1, os.cpus().length),
    // Inline small stylesheets automatically
    inlineStylesheets: 'auto'
  },

  // HTML compression
  compressHTML: true,

  // Image optimization settings
  image: {
    service: {
      entrypoint: 'astro/assets/services/sharp',
      config: {
        // Limit input pixels to prevent memory issues with large images
        limitInputPixels: 268402689 // ~16384x16384
      }
    }
  },

  // Responsive images for automatic srcset generation (now stable in Astro 5)
  // Note: responsiveImages was moved from experimental to stable in Astro 5.x

  vite: {
    plugins: [tailwindcss()],
    build: {
      chunkSizeWarningLimit: 1000
    },
    optimizeDeps: {
      include: ['web-vitals']
    },
    css: {
      devSourcemap: false
    }
  }
})
