import { fromPartial } from '@total-typescript/shoehorn'
import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { toValue } from 'vue'
import { createI18n } from 'vue-i18n'

import type { useFeatureFlags } from '@/composables/useFeatureFlags'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { api } from '@/scripts/api'
import { useAssetsStore } from '@/stores/assetsStore'

import AssetsSidebarTab from './AssetsSidebarTab.vue'

vi.mock(import('@/composables/useFeatureFlags'), () => ({
  useFeatureFlags: () =>
    fromPartial<ReturnType<typeof useFeatureFlags>>({
      flags: { assetsEnabled: true }
    })
}))

vi.mock(import('@/platform/assets/composables/useMediaAssetActions'))

const outputs: AssetItem[] = Array.from({ length: 3 }, (_, i) => ({
  id: `out-${i}`,
  name: `out-${i}.png`,
  tags: ['output'],
  created_at: new Date(3000 - i).toISOString(),
  updated_at: new Date(3000 - i).toISOString()
}))

const newest: AssetItem = {
  id: 'out-new',
  name: 'out-new.png',
  tags: ['output'],
  created_at: new Date(4000).toISOString(),
  updated_at: new Date(4000).toISOString()
}

const older: AssetItem = {
  id: 'out-old',
  name: 'out-old.png',
  tags: ['output'],
  created_at: new Date(1000).toISOString(),
  updated_at: new Date(1000).toISOString()
}

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {} } })

function renderTab() {
  return render(AssetsSidebarTab, {
    global: {
      plugins: [i18n],
      directives: { tooltip: {} },
      stubs: {
        AssetsSidebarGridView: {
          props: ['assets'],
          template:
            '<ul data-testid="assets-grid"><li v-for="a in assets" :key="a.id">{{ a.name }}</li></ul>'
        },
        AssetsSidebarListView: true,
        MediaAssetFilterBar: true,
        MediaAssetSelectionBar: true,
        MediaLightbox: true
      }
    }
  })
}

const OUTPUT_TAGS = 'output,temp'

function shownAssets() {
  return within(screen.getByTestId('assets-grid'))
    .queryAllByRole('listitem')
    .map((item) => item.textContent)
}

function outputRequests() {
  return vi
    .mocked(api.fetchApi)
    .mock.calls.map(([url]) => new URL(url, 'http://x'))
    .filter(
      (url) =>
        url.pathname === '/assets' &&
        url.searchParams.get('tags_any') === OUTPUT_TAGS
    )
    .map((url) => url.searchParams)
}

function serveAssets(outputPage: () => Promise<Response>) {
  vi.spyOn(api, 'fetchApi').mockImplementation(async (route) =>
    new URL(route, 'http://x').searchParams.get('tags_any') === OUTPUT_TAGS
      ? outputPage()
      : Response.json({ assets: [], total: 0, has_more: false })
  )
}

describe('AssetsSidebarTab reopen with the asset API', () => {
  it('keeps the loaded list on screen and fetches only the head', async () => {
    serveAssets(async () =>
      Response.json({
        assets: outputs,
        total: 6,
        has_more: true,
        next_cursor: 'out-2'
      })
    )
    const first = renderTab()
    await vi.waitFor(() => {
      expect(shownAssets()).toHaveLength(3)
      expect(toValue(useAssetsStore().outputAssets.isLoading)).toBe(false)
    })
    first.unmount()
    const requestsBeforeReopen = outputRequests().length

    let respond!: (response: Response) => void
    serveAssets(() => new Promise((resolve) => (respond = resolve)))
    renderTab()

    await vi.waitFor(() =>
      expect(outputRequests()).toHaveLength(requestsBeforeReopen + 1)
    )
    expect(shownAssets()).toEqual(['out-0.png', 'out-1.png', 'out-2.png'])
    expect(outputRequests().at(-1)?.get('limit')).toBe('10')

    respond(
      Response.json({ assets: [newest, ...outputs], total: 7, has_more: true })
    )
    serveAssets(async () =>
      Response.json({ assets: [], total: 6, has_more: false })
    )
    await useAssetsStore().outputAssets.loadMore()

    expect(outputRequests().at(-1)?.get('after')).toBe('out-2')
    expect(shownAssets()).toEqual([
      'out-new.png',
      'out-0.png',
      'out-1.png',
      'out-2.png'
    ])
  })

  it('retries a failed older page after the panel is reopened', async () => {
    serveAssets(async () =>
      Response.json({
        assets: outputs,
        total: 4,
        has_more: true,
        next_cursor: 'out-2'
      })
    )
    const first = renderTab()
    const outputAssets = useAssetsStore().outputAssets
    await vi.waitFor(() => {
      expect(shownAssets()).toHaveLength(3)
      expect(toValue(outputAssets.isLoading)).toBe(false)
    })
    serveAssets(async () => new Response(null, { status: 403 }))
    await outputAssets.loadMore()
    expect(toValue(outputAssets.hasMore)).toBe(false)
    first.unmount()

    serveAssets(async () =>
      Response.json({ assets: outputs, total: 4, has_more: true })
    )
    renderTab()
    await vi.waitFor(() => expect(toValue(outputAssets.hasMore)).toBe(true))

    serveAssets(async () =>
      Response.json({ assets: [older], total: 4, has_more: false })
    )
    await outputAssets.loadMore()
    expect(shownAssets()).toEqual([
      'out-0.png',
      'out-1.png',
      'out-2.png',
      'out-old.png'
    ])
  })
})
