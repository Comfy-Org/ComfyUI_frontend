import { render, screen } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import AssetCard from '@/platform/assets/components/AssetCard.vue'
import type { AssetDisplayItem } from '@/platform/assets/composables/useAssetBrowser'

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: () => 0
  })
}))

vi.mock('@/stores/assetDownloadStore', () => ({
  useAssetDownloadStore: () => ({
    isDownloadedThisSession: () => false,
    acknowledgeAsset: vi.fn()
  })
}))

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({
    closeDialog: vi.fn()
  })
}))

vi.mock('@/platform/assets/services/assetService', () => ({
  assetService: {
    deleteAsset: vi.fn()
  }
}))

vi.mock('@/components/dialog/confirm/confirmDialog', () => ({
  showConfirmDialog: vi.fn()
}))

vi.mock('@vueuse/core', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@vueuse/core')
  return {
    ...actual,
    useImage: () => ({ isLoading: false, error: null })
  }
})

const HASH = 'blake3:abc123def456'
const ORIGINAL_FILENAME = 'sunset_photo.png'

function createDisplayAsset(
  overrides: Partial<AssetDisplayItem> = {}
): AssetDisplayItem {
  return {
    id: 'asset-1',
    name: HASH,
    asset_hash: HASH,
    tags: ['input'],
    preview_url: '/preview.png',
    secondaryText: '',
    badges: [],
    stats: {},
    user_metadata: {},
    metadata: { filename: ORIGINAL_FILENAME },
    ...overrides
  }
}

function renderCard(asset: AssetDisplayItem) {
  setActivePinia(createPinia())
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: {} },
    missingWarn: false,
    fallbackWarn: false
  })
  return render(AssetCard, {
    props: { asset, interactive: true },
    global: {
      plugins: [i18n],
      stubs: {
        AssetBadgeGroup: true,
        IconGroup: true,
        MoreButton: true,
        Badge: true,
        Button: { template: '<button><slot /></button>' }
      },
      directives: {
        tooltip: {}
      }
    }
  })
}

describe('AssetCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('FE-228: filename rendering', () => {
    it('renders the human-readable filename instead of asset_hash when asset.name equals asset_hash', () => {
      const asset = createDisplayAsset()

      renderCard(asset)

      const heading = screen.getByRole('heading', { level: 3 })
      expect(heading).toHaveTextContent(ORIGINAL_FILENAME)
      expect(heading).not.toHaveTextContent(HASH)
    })

    it('falls back to display_name when user_metadata.filename and metadata.filename are absent', () => {
      const asset = createDisplayAsset({
        metadata: undefined,
        user_metadata: undefined,
        display_name: ORIGINAL_FILENAME
      })

      renderCard(asset)

      const heading = screen.getByRole('heading', { level: 3 })
      expect(heading).toHaveTextContent(ORIGINAL_FILENAME)
      expect(heading).not.toHaveTextContent(HASH)
    })
  })

  describe('preserves user-curated display name', () => {
    const CURATED_NAME = 'My Favorite SDXL LoRA'
    const MODEL_FILENAME = 'lora_v1_epoch4.safetensors'

    it('renders the curated name (user_metadata.name) when it differs from the raw asset.name', () => {
      const asset = createDisplayAsset({
        id: 'model-1',
        name: MODEL_FILENAME,
        asset_hash: undefined,
        tags: ['models', 'loras'],
        user_metadata: { name: CURATED_NAME },
        metadata: { filename: MODEL_FILENAME }
      })

      renderCard(asset)

      const heading = screen.getByRole('heading', { level: 3 })
      expect(heading).toHaveTextContent(CURATED_NAME)
      expect(heading).not.toHaveTextContent(MODEL_FILENAME)
    })

    it('ignores user_metadata.name that duplicates the hash and falls back to metadata.filename', () => {
      const asset = createDisplayAsset({
        name: HASH,
        asset_hash: HASH,
        user_metadata: { name: HASH },
        metadata: { filename: ORIGINAL_FILENAME }
      })

      renderCard(asset)

      const heading = screen.getByRole('heading', { level: 3 })
      expect(heading).toHaveTextContent(ORIGINAL_FILENAME)
      expect(heading).not.toHaveTextContent(HASH)
    })
  })
})
