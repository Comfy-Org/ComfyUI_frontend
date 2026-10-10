import { fromPartial } from '@total-typescript/shoehorn'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { useFeatureFlags } from '@/composables/useFeatureFlags'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { api } from '@/scripts/api'

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

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {} } })

function renderTab() {
  return render(AssetsSidebarTab, {
    global: {
      plugins: [i18n],
      directives: { tooltip: {} },
      stubs: {
        AssetsSidebarGridView: {
          template: '<div data-testid="assets-grid" />'
        },
        AssetsSidebarListView: true,
        MediaAssetFilterBar: true,
        MediaAssetSelectionBar: true,
        MediaLightbox: true
      }
    }
  })
}

function listRequests() {
  return vi
    .mocked(api.fetchApi)
    .mock.calls.map(([url]) => new URL(url, 'http://x').searchParams)
    .filter((params) => params.get('tags_any') !== 'input')
}

describe('AssetsSidebarTab reopen with the asset API', () => {
  it('keeps the loaded list on screen and fetches only the head', async () => {
    vi.spyOn(api, 'fetchApi').mockImplementation(async () =>
      Response.json({ assets: outputs, total: outputs.length, has_more: false })
    )
    const first = renderTab()
    await vi.waitFor(() =>
      expect(screen.getByTestId('assets-grid')).toBeVisible()
    )
    first.unmount()
    const requestsBeforeReopen = listRequests().length

    let respond!: (response: Response) => void
    vi.mocked(api.fetchApi).mockImplementation(
      () => new Promise((resolve) => (respond = resolve))
    )
    renderTab()

    await vi.waitFor(() =>
      expect(listRequests()).toHaveLength(requestsBeforeReopen + 1)
    )
    expect(screen.getByTestId('assets-grid')).toBeVisible()
    expect(listRequests().at(-1)?.get('limit')).toBe('10')
    respond(
      Response.json({ assets: outputs, total: outputs.length, has_more: false })
    )
  })
})
