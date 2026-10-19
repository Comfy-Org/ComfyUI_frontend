import type {
  CccWebsiteCardsPage,
  ContentCatalogRecord
} from '@comfyorg/ingest-types'
import { assert, expect, it, vi } from 'vitest'

import { modelsHubIndexModels } from './models-hub-index'

function modelCard(index: number): ContentCatalogRecord {
  const uid = `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`
  return {
    uid,
    edit_version: uid,
    revision: 1,
    deleted: false,
    enabled: true,
    visibility: 'PUBLIC',
    kind: 'MODEL',
    slug: `/hub/models/model-${index}`,
    data: { type: 'model', title: `Model ${index}`, slug: `model-${index}` }
  }
}

function cardsPage(
  items: ContentCatalogRecord[],
  nextCursor?: string
): CccWebsiteCardsPage {
  return {
    revision_id: 4,
    items,
    page_size: 24,
    has_more: Boolean(nextCursor),
    ...(nextCursor ? { next_cursor: nextCursor } : {}),
    available_kinds: ['MODEL'],
    sort_orders: ['popular', 'name'],
    facets: { categories: [], models: [], use_cases: [] }
  }
}

it('indexes every Live model in CMS mode, not only the first page of 24', async () => {
  vi.stubEnv('SITE_CATALOG_API_URL', 'http://localhost:8099')
  vi.stubEnv('VERCEL_ENV', 'development')
  const cards = Array.from({ length: 30 }, (_, index) => modelCard(index + 1))
  vi.mocked(fetch).mockImplementation(async (input) =>
    Response.json(
      new URL(String(input)).searchParams.get('cursor') === 'second'
        ? cardsPage(cards.slice(24))
        : cardsPage(cards.slice(0, 24), 'second')
    )
  )
  const index = await modelsHubIndexModels(undefined, 'en')
  assert.isTrue(index.ok)
  expect(index.models.map((model) => model.name)).toEqual(
    cards.map((card) => card.data.title)
  )
})
