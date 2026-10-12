// @vitest-environment node
import { createContext } from 'astro/middleware'
import { describe, expect, it } from 'vitest'
import {
  commitCatalogPreview,
  currentCatalogPreview,
  CATALOG_PREVIEW_COOKIE,
  CATALOG_LOCALE_COOKIE,
  selectCatalogPreview
} from './catalog-preview'

function context(path = '/hub/models/') {
  return createContext({
    request: new Request(`https://website.example${path}`),
    defaultLocale: 'en',
    clientAddress: '127.0.0.1'
  })
}

describe('catalog preview state', () => {
  it('keeps time when switching view, NOW keeps Draft, EXIT clears private view but keeps locale', () => {
    const ctx = context()
    commitCatalogPreview(ctx, {
      view: 'DRAFT',
      now: '2030-01-02T09:00:00-08:00',
      locale: 'zh-CN'
    })
    expect(currentCatalogPreview(ctx)).toEqual({
      view: 'DRAFT',
      now: '2030-01-02T17:00:00.000Z'
    })
    commitCatalogPreview(ctx, { view: 'LIVE' })
    expect(currentCatalogPreview(ctx)).toEqual({
      view: 'LIVE',
      now: '2030-01-02T17:00:00.000Z'
    })
    commitCatalogPreview(ctx, { view: 'DRAFT', now: 'now' })
    expect(currentCatalogPreview(ctx)).toEqual({ view: 'DRAFT' })
    commitCatalogPreview(ctx, { view: 'LIVE', now: 'now' })
    expect(ctx.cookies.has(CATALOG_PREVIEW_COOKIE)).toBe(false)
    expect(currentCatalogPreview(ctx)).toEqual({ view: 'LIVE' })
    expect(ctx.cookies.get(CATALOG_LOCALE_COOKIE)?.value).toBe('zh-CN')
    expect([...ctx.cookies.headers()].join('\n')).toContain('HttpOnly')
  })
  it.each([
    '/hub/models/?preview=DRAFT',
    '/hub/models/?preview_at=2030-01-01T00:00:00Z',
    '/hub/models/?now=now'
  ])('never sets Preview from an anonymous request: %s', (path) => {
    const ctx = context(path)
    expect(selectCatalogPreview(ctx)?.status).toBe(403)
    expect(ctx.cookies.has(CATALOG_PREVIEW_COOKIE)).toBe(false)
  })
  it('malformed or forged cookie cannot select a revision or unsafe date', () => {
    const ctx = context()
    ctx.cookies.set(CATALOG_PREVIEW_COOKIE, '{"view":"ARCHIVED","now":"never"}')
    expect(currentCatalogPreview(ctx)).toEqual({ view: 'LIVE' })
  })
})
