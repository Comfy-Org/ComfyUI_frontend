import type { APIContext } from 'astro'
import { z } from 'astro/zod'
import { cookieOptions, parsePreview } from './admin'
import { isCatalogLocale } from '@/config/catalog-locales'
import type { CatalogLocale } from '@/config/catalog-locales'

export const CATALOG_PREVIEW_COOKIE = 'comfy_catalog_preview'
export const CATALOG_LOCALE_COOKIE = 'comfy_catalog_locale'
export const previewCommand = z
  .object({
    view: z.enum(['DRAFT', 'LIVE']),
    now: z
      .union([z.literal('now'), z.string().datetime({ offset: true })])
      .optional(),
    locale: z
      .custom<CatalogLocale>((value) => isCatalogLocale(value))
      .optional()
  })
  .strict()
export type CatalogPreview = NonNullable<ReturnType<typeof parsePreview>>

export function currentCatalogPreview(context: APIContext): CatalogPreview {
  return (
    parsePreview(context.cookies.get(CATALOG_PREVIEW_COOKIE)?.value) ?? {
      view: 'LIVE'
    }
  )
}

export function commitCatalogPreview(
  context: APIContext,
  command: z.infer<typeof previewCommand>
) {
  const previous = currentCatalogPreview(context)
  const selected = {
    view: command.view,
    ...(command.now === 'now'
      ? {}
      : command.now
        ? { now: new Date(command.now).toISOString() }
        : previous.now
          ? { now: previous.now }
          : {})
  }
  if (selected.view === 'LIVE' && !selected.now)
    context.cookies.delete(CATALOG_PREVIEW_COOKIE, { path: '/' })
  else
    context.cookies.set(
      CATALOG_PREVIEW_COOKIE,
      JSON.stringify(selected),
      cookieOptions(context)
    )
  if (command.locale)
    context.cookies.set(
      CATALOG_LOCALE_COOKIE,
      command.locale,
      cookieOptions(context)
    )
}

export function selectCatalogPreview(context: APIContext) {
  const query = context.url.searchParams
  if (!['preview', 'preview_at', 'now'].some((key) => query.has(key)))
    return undefined
  if (!context.locals.catalogAuthoring)
    return new Response('Access denied', {
      status: 403,
      headers: { 'Cache-Control': 'private, no-store' }
    })
  if (
    ['preview', 'preview_at', 'now'].some(
      (key) => query.getAll(key).length > 1
    ) ||
    (query.has('preview_at') && query.has('now'))
  )
    return new Response('Invalid preview selection', { status: 400 })
  const previous = currentCatalogPreview(context)
  const parsed = previewCommand.safeParse({
    view: query.get('preview') ?? previous.view,
    ...(query.has('preview_at') || query.has('now')
      ? { now: query.get('preview_at') ?? query.get('now') }
      : {})
  })
  if (!parsed.success)
    return new Response('Invalid preview selection', { status: 400 })
  commitCatalogPreview(context, parsed.data)
  for (const key of ['preview', 'preview_at', 'now']) query.delete(key)
  return context.redirect(context.url.pathname + context.url.search, 303)
}
