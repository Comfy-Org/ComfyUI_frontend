// Exercise the server's HTTP request implementation, not happy-dom's browser
// Request, which strips the Origin header before the handler can validate it.
// @vitest-environment node
import { createContext } from 'astro/middleware'
import type { ContentCatalogReview } from '@comfyorg/ingest-types'
import { describe, expect, it, vi } from 'vitest'
import { POST } from './actions'
import { CONTEXT_COOKIE, CSRF_COOKIE } from '@/lib/cms/admin'

const review: ContentCatalogReview = {
  draft: { revision_id: 2, generation: 1, items: [] },
  live: { revision_id: 1, generation: 1, items: [] },
  can_edit: true,
  can_apply: false,
  history: []
}

describe('Preview controls', () => {
  it.for(['preview', 'exit'])(
    '%s returns to real-time LIVE without Preview',
    async (action) => {
      vi.stubEnv('SITE_CATALOG_WEBSITE_ORIGINS', 'https://preview.example')
      const csrf = 'a'.repeat(64)
      const context = createContext({
        request: new Request('https://preview.example/admin/actions', {
          method: 'POST',
          headers: {
            Origin: 'https://preview.example',
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            csrf,
            action,
            view: 'LIVE',
            now: '2026-10-15T16:00:00Z'
          }).toString()
        }),
        defaultLocale: 'en',
        clientAddress: '127.0.0.1'
      })
      context.cookies.set(CSRF_COOKIE, csrf)
      context.cookies.set(
        CONTEXT_COOKIE,
        JSON.stringify({ view: 'DRAFT', now: '2026-10-15T16:00:00Z' })
      )
      context.locals.site = {
        credential: 'test-only',
        review,
        csrf,
        preview: { view: 'DRAFT', now: '2026-10-15T16:00:00Z' }
      }
      expect(context.request.headers.get('origin')).toBe(
        'https://preview.example'
      )
      expect(context.cookies.get(CSRF_COOKIE)?.value).toBe(csrf)
      expect((await context.request.clone().formData()).get('csrf')).toBe(csrf)
      const response = await POST(context)
      expect(response.status).toBe(303)
      expect(response.headers.get('Location')).toBe('/hub/models/')
      expect(context.cookies.has(CONTEXT_COOKIE)).toBe(false)
    }
  )
})
