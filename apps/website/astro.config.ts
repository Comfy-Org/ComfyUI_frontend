import { defineConfig } from 'astro/config'
import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'
import vue from '@astrojs/vue'
import tailwindcss from '@tailwindcss/vite'
import { isExcludedFromSitemap } from './src/config/indexing'
import { DEFAULT_LOCALE, LOCALE_CODES } from './src/config/locales'
import { redirects } from './src/config/redirects'
import { localizedSitemap } from './src/integrations/localized-sitemap'
import { markdownTwins } from './src/integrations/markdown-twins'
import { workshopReleaseGate } from './src/integrations/workshop-release-gate'
import { sitemapAlternates } from './src/lib/hreflang'

/** The canonical origin. One constant, because the sitemap integration
 * needs the same value and a second literal can drift from this one. */
const SITE = 'https://comfy.org'

export default defineConfig({
  site: SITE,
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
    // After sitemap(): it builds from Astro's page list, which omits the routes
    // the i18n fallback produces for dynamic routes. This adds them back.
    localizedSitemap(SITE),
    markdownTwins(),
    workshopReleaseGate()
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
    locales: [...LOCALE_CODES],
    defaultLocale: DEFAULT_LOCALE,
    /**
     * Serve a locale's URL from the English page file when that locale has no
     * file of its own. This is what lets one source file serve every language:
     * the page reads its own `Astro.currentLocale` and asks the dictionary for
     * that language, so `/ja/pricing` renders from `pricing.astro`.
     *
     * Both localized locales have one, and every locale added later needs one
     * too: without it, a locale served from the English file is a tree of 404s.
     * `astroI18n.test.ts` fails if a locale is missing an entry.
     *
     * Astro's fallback is per-locale with no route granularity, so this also
     * mints localized URLs for the 401 routes that are deliberately
     * English-only — the model catalogue, Enterprise, the legal documents. Those
     * are held back rather than hidden: `isExcludedFromSitemap` keeps a
     * localized copy of a locale-invariant route out of the sitemap, and
     * `hreflangAlternates` refuses to cluster it, so each canonicals to its
     * English original and is advertised nowhere.
     *
     * Japanese is held back the same way, but by a different gate.
     * `PARTIAL_LOCALE_ROUTES.ja` names the six routes it publishes — `/`,
     * `/download`, `/cloud`, `/platform`, `/about`, `/pricing` — and everything
     * else is built, unadvertised and unlinked. `INDEXABLE_PAGES.ja` is `'all'`
     * because that gate has already decided; the two would otherwise have to
     * agree about the same list twice. Widening Japanese means adding routes
     * there, in a reviewed change of its own.
     *
     * French publishes nothing yet. It needs the fallback so the pipeline has
     * pages to translate against, but `PARTIAL_LOCALE_ROUTES.fr` is empty until
     * the nightly has filled it — every `/fr/` URL is built, unadvertised and
     * unlinked, and none is indexed.
     */
    fallback: {
      ja: DEFAULT_LOCALE,
      'zh-CN': DEFAULT_LOCALE,
      fr: DEFAULT_LOCALE
    },
    routing: {
      prefixDefaultLocale: false,
      // Belongs HERE, under `routing`. One level up, directly on `i18n`, Astro
      // accepts it, ignores it, and emits redirect stubs instead of pages —
      // a build that looks successful and does the opposite. `astroI18n.test.ts`
      // fails if it moves.
      fallbackType: 'rewrite'
    }
  }
})
