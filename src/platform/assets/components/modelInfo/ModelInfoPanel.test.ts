import { createTestingPinia } from '@pinia/testing'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { render, screen } from '@testing-library/vue'

import type { AssetDisplayItem } from '@/platform/assets/composables/useAssetBrowser'

import ModelInfoPanel from './ModelInfoPanel.vue'

vi.mock('@/composables/useCopyToClipboard', () => ({
  useCopyToClipboard: () => ({
    copyToClipboard: vi.fn()
  })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} },
  missingWarn: false,
  fallbackWarn: false
})

describe('ModelInfoPanel', () => {
  const createMockAsset = (
    overrides: Partial<AssetDisplayItem> = {}
  ): AssetDisplayItem => ({
    id: 'test-id',
    name: 'test-model.safetensors',
    asset_hash: 'hash123',
    size: 1024,
    mime_type: 'application/octet-stream',
    tags: ['models', 'checkpoints'],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    last_access_time: '2024-01-01T00:00:00Z',
    secondaryText: 'A test model description',
    badges: [],
    stats: {},
    ...overrides
  })

  function renderPanel(asset: AssetDisplayItem) {
    return render(ModelInfoPanel, {
      props: { asset },
      global: {
        plugins: [createTestingPinia({ stubActions: false }), i18n]
      }
    })
  }

  describe('Basic Info Section', () => {
    it('renders basic info section', () => {
      renderPanel(createMockAsset())
      expect(
        screen.getByText('assetBrowser.modelInfo.basicInfo')
      ).toBeInTheDocument()
    })

    it('displays asset filename', () => {
      const asset = createMockAsset({ name: 'my-model.safetensors' })
      renderPanel(asset)
      expect(
        screen.getAllByText('my-model.safetensors').length
      ).toBeGreaterThanOrEqual(1)
    })

    it('prefers user_metadata.filename over asset.name for filename field', () => {
      const asset = createMockAsset({
        name: 'registry-display-name',
        user_metadata: { filename: 'checkpoints/real-file.safetensors' }
      })
      renderPanel(asset)
      expect(
        screen.getByText('checkpoints/real-file.safetensors')
      ).toBeInTheDocument()
    })

    it('displays name from user_metadata when present', () => {
      const asset = createMockAsset({
        user_metadata: { name: 'My Custom Model' }
      })
      renderPanel(asset)
      expect(screen.getByText('My Custom Model')).toBeInTheDocument()
    })

    it('falls back to asset name when user_metadata.name not present', () => {
      const asset = createMockAsset({ name: 'fallback-model.safetensors' })
      renderPanel(asset)
      expect(
        screen.getAllByText('fallback-model.safetensors').length
      ).toBeGreaterThanOrEqual(1)
    })

    it('renders source link when source_arn is present', () => {
      const asset = createMockAsset({
        user_metadata: { source_arn: 'civitai:model:123:version:456' }
      })
      renderPanel(asset)
      const link = screen.getByRole('link')
      expect(link).toHaveAttribute(
        'href',
        'https://civitai.com/models/123?modelVersionId=456'
      )
      expect(link).toHaveAttribute('target', '_blank')
    })

    it('displays Civitai icon for Civitai source', () => {
      const asset = createMockAsset({
        user_metadata: { source_arn: 'civitai:model:123:version:456' }
      })
      renderPanel(asset)
      expect(screen.getByRole('img')).toHaveAttribute(
        'src',
        '/assets/images/civitai.svg'
      )
    })

    it('does not render source field when source_arn is absent', () => {
      renderPanel(createMockAsset())
      expect(screen.queryAllByRole('link')).toHaveLength(0)
    })
  })

  describe('Model Tagging Section', () => {
    it('renders model tagging section', () => {
      renderPanel(createMockAsset())
      expect(
        screen.getByText('assetBrowser.modelInfo.modelTagging')
      ).toBeInTheDocument()
    })

    it('renders model type field', () => {
      renderPanel(createMockAsset())
      expect(
        screen.getByText('assetBrowser.modelInfo.modelType')
      ).toBeInTheDocument()
    })

    it('renders base models field', () => {
      const asset = createMockAsset({
        user_metadata: { base_model: ['SDXL'] }
      })
      renderPanel(asset)
      expect(
        screen.getByText('assetBrowser.modelInfo.compatibleBaseModels')
      ).toBeInTheDocument()
    })

    it('renders additional tags field', () => {
      renderPanel(createMockAsset())
      expect(
        screen.getByText('assetBrowser.modelInfo.additionalTags')
      ).toBeInTheDocument()
    })
  })

  describe('Model Description Section', () => {
    it('renders trigger phrases when present', () => {
      const asset = createMockAsset({
        user_metadata: { trained_words: ['trigger1', 'trigger2'] }
      })
      renderPanel(asset)
      expect(screen.getByText('trigger1')).toBeInTheDocument()
      expect(screen.getByText('trigger2')).toBeInTheDocument()
    })

    it('renders description section', () => {
      renderPanel(createMockAsset())
      expect(
        screen.getByText('assetBrowser.modelInfo.modelDescription')
      ).toBeInTheDocument()
    })

    it('does not render trigger phrases field when empty', () => {
      renderPanel(createMockAsset())
      expect(
        screen.queryByText('assetBrowser.modelInfo.triggerPhrases')
      ).not.toBeInTheDocument()
    })
  })

  describe('Accordion Structure', () => {
    it('renders all three section labels', () => {
      renderPanel(createMockAsset())
      expect(
        screen.getByText('assetBrowser.modelInfo.basicInfo')
      ).toBeInTheDocument()
      expect(
        screen.getByText('assetBrowser.modelInfo.modelTagging')
      ).toBeInTheDocument()
      expect(
        screen.getByText('assetBrowser.modelInfo.modelDescription')
      ).toBeInTheDocument()
    })
  })
})
