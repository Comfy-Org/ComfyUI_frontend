import type { z } from 'zod'
import type { Locale } from '../i18n/locales'

import { toLocale } from '../i18n/locales'

/**
 * Public production CMS URL, committed as a non-secret default so an open-source
 * clone or offline `pnpm build` fetches the same published content the real
 * deploy does (published CMS content is public). Overridable per environment via
 * `WEBSITE_CMS_URL`.
 *
 * TODO(build): confirm this is the real production CMS domain before release —
 * it is a placeholder (see `build-spec.md` → "Facts to supply at build time").
 */
export const DEFAULT_CMS_URL = 'https://cms.comfy.org'

/** One CMS-backed collection's list view: how to query, validate, and flatten it. */
interface CmsListView<TDoc, TItem> {
  /** Payload REST query string (the `select`/`populate`/`sort` params). */
  query: string
  /** Zod schema for the `{ docs }` response, parsed from raw JSON. */
  schema: z.ZodType<{ docs: TDoc[] }, z.ZodTypeDef, unknown>
  /**
   * Flatten a CMS doc into the shape the Astro template consumes. `locale` is
   * the locale the docs were requested in, for the fields the CMS cannot
   * pre-localize (a site-relative `href` is stored unlocalized).
   */
  toItem: (doc: TDoc, cmsBase: string, locale: Locale) => TItem
}

/** A CMS-backed content collection's list descriptor (e.g. gallery). */
export interface CmsCollection<TDoc, TItem> {
  /** CMS collection slug → `/api/<slug>`. */
  slug: string
  list: CmsListView<TDoc, TItem>
}

export interface LoadContentOptions {
  /** Override the CMS base URL (else `WEBSITE_CMS_URL`, else `DEFAULT_CMS_URL`). */
  cmsUrl?: string
  /** Fetch unpublished drafts. Defaults to the `PREVIEW_MODE` build flag. */
  draft?: boolean
  /**
   * CMS locale to request (e.g. `zh-CN`). Non-default locales append the Payload
   * REST `locale` param; the default (`en`)/absent case sends no param, leaving
   * the default request path unchanged. Relies on the CMS fallback to `en` for
   * fields with no value in the requested locale.
   */
  locale?: string
  /** Payload API key for authenticated draft reads. Defaults to `PAYLOAD_API_KEY`. */
  apiKey?: string
  /** Injectable fetch, for tests. */
  fetchImpl?: typeof fetch
}

function resolveCmsBase(cmsUrl?: string): string {
  const url =
    cmsUrl ??
    import.meta.env.WEBSITE_CMS_URL ??
    process.env.WEBSITE_CMS_URL ??
    DEFAULT_CMS_URL
  return url.replace(/\/$/, '')
}

/**
 * Fetch and flatten a collection's list from the CMS. Shared by every collection
 * and by both production (published) and preview (`draft`) builds.
 *
 * Throws when the CMS is configured but unreachable, responds non-OK, or returns
 * a payload that fails schema validation — failing the build so the last good
 * deploy is kept, rather than shipping degraded content.
 */
export async function loadList<TDoc, TItem>(
  collection: CmsCollection<TDoc, TItem>,
  options: LoadContentOptions = {}
): Promise<TItem[]> {
  const base = resolveCmsBase(options.cmsUrl)
  // `draft`/`apiKey` come from the same build env as the CMS URL above, so they
  // default here rather than being threaded through every page's frontmatter —
  // a new collection cannot forget to wire up draft preview.
  const {
    locale,
    draft = import.meta.env.PREVIEW_MODE === 'true',
    apiKey = import.meta.env.PAYLOAD_API_KEY
  } = options
  const fetchImpl = options.fetchImpl ?? fetch

  // The default locale (`en`) is requested by sending no `locale` param, so the
  // default request path is byte-for-byte unchanged. Only non-default locales
  // append it.
  const localized =
    locale && locale !== 'en'
      ? `${collection.list.query}&locale=${locale}`
      : collection.list.query
  const query = draft ? `${localized}&draft=true` : localized
  const headers =
    draft && apiKey ? { Authorization: `users API-Key ${apiKey}` } : undefined

  const response = await fetchImpl(`${base}/api/${collection.slug}?${query}`, {
    headers
  })
  if (!response.ok) {
    throw new Error(`[${collection.slug}] CMS responded ${response.status}`)
  }

  const parsed = collection.list.schema.safeParse(await response.json())
  if (!parsed.success) {
    throw new Error(
      `[${collection.slug}] CMS response failed schema validation: ${parsed.error.message}`
    )
  }

  return parsed.data.docs.map((doc) =>
    collection.list.toItem(doc, base, toLocale(locale))
  )
}
