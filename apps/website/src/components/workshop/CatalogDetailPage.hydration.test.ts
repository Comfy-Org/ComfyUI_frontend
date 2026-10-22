import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import { loadCatalogDetailPage } from '@/lib/cms/detail-page-server'
import { entries } from '@website/scripts/export-cms-seed'
import CatalogDetailPage from './CatalogDetailPage.vue'

const record = entries.find((entry) => entry.kind === 'MODEL')!

// The record the route's server load would pass to the island.
async function serverRecord() {
  vi.stubEnv('SITE_CATALOG_API_URL', 'http://localhost:8099')
  vi.mocked(fetch).mockResolvedValue(
    Response.json({
      revision_id: 1,
      generation: 0,
      items: [
        { ...record, revision: 1, deleted: false, edit_version: record.uid }
      ]
    })
  )
  const load = await loadCatalogDetailPage({}, `${record.slug}/`, 'en')
  if (load.status !== 'ok') throw new Error(load.status)
  vi.mocked(fetch).mockClear()
  return load.page
}

describe('CatalogDetailPage hydration', () => {
  it('uses the server-rendered record without fetching it again', async () => {
    const initial = await serverRecord()
    render(CatalogDetailPage, {
      props: { path: `${record.slug}/`, initial }
    })
    expect(
      screen.getByRole('heading', { level: 1, name: initial.model.name })
    ).toBeTruthy()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('shows the server 404 without fetching', () => {
    render(CatalogDetailPage, {
      props: { path: '/hub/models/missing/', initialMissing: true }
    })
    expect(
      screen.getByRole('heading', { level: 1, name: 'Content not found' })
    ).toBeTruthy()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('still fetches the record when the server did not render one', () => {
    vi.mocked(fetch).mockResolvedValue(new Response('', { status: 503 }))
    render(CatalogDetailPage, { props: { path: `${record.slug}/` } })
    expect(fetch).toHaveBeenCalledOnce()
  })
})
