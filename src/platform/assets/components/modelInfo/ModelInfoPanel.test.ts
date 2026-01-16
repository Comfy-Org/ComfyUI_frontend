import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import type { AssetDisplayItem } from '@/platform/assets/composables/useAssetBrowser'

import ModelInfoPanel from './ModelInfoPanel.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, string>) =>
      params ? `${key}:${JSON.stringify(params)}` : key
  })
}))

vi.mock(
  '@/components/rightSidePanel/layout/PropertiesAccordionItem.vue',
  () => ({
    default: {
      name: 'PropertiesAccordionItem',
      template: `
      <div data-testid="accordion-item">
        <div data-testid="accordion-label"><slot name="label" /></div>
        <div data-testid="accordion-content"><slot /></div>
      </div>
    `
    }
  })
)

vi.mock('./ModelInfoField.vue', () => ({
  default: {
    name: 'ModelInfoField',
    props: ['label'],
    template: `
      <div data-testid="model-info-field" :data-label="label">
        <span>{{ label }}</span>
        <slot />
      </div>
    `
  }
}))

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
    description: 'A test model description',
    badges: [],
    stats: {},
    ...overrides
  })

  const mountPanel = (asset: AssetDisplayItem) => {
    return mount(ModelInfoPanel, {
      props: { asset },
      global: {
        mocks: {
          $t: (key: string, params?: Record<string, string>) =>
            params ? `${key}:${JSON.stringify(params)}` : key
        }
      }
    })
  }

  describe('Basic Info Section', () => {
    it('renders panel title', () => {
      const wrapper = mountPanel(createMockAsset())
      expect(wrapper.text()).toContain('assetBrowser.modelInfo.title')
    })

    it('displays asset filename', () => {
      const asset = createMockAsset({ name: 'my-model.safetensors' })
      const wrapper = mountPanel(asset)
      expect(wrapper.text()).toContain('my-model.safetensors')
    })

    it('displays display_name from user_metadata when present', () => {
      const asset = createMockAsset({
        user_metadata: { display_name: 'My Custom Model' }
      })
      const wrapper = mountPanel(asset)
      expect(wrapper.text()).toContain('My Custom Model')
    })

    it('falls back to asset name when display_name not present', () => {
      const asset = createMockAsset({ name: 'fallback-model.safetensors' })
      const wrapper = mountPanel(asset)
      expect(wrapper.text()).toContain('fallback-model.safetensors')
    })

    it('renders source link when source_url is present', () => {
      const asset = createMockAsset({
        user_metadata: { source_url: 'https://civitai.com/models/123' }
      })
      const wrapper = mountPanel(asset)
      const link = wrapper.find('a[href="https://civitai.com/models/123"]')
      expect(link.exists()).toBe(true)
      expect(link.attributes('target')).toBe('_blank')
    })

    it('displays correct source name for Civitai', () => {
      const asset = createMockAsset({
        user_metadata: { source_url: 'https://civitai.com/models/123' }
      })
      const wrapper = mountPanel(asset)
      expect(wrapper.text()).toContain('Civitai')
    })

    it('displays correct source name for Hugging Face', () => {
      const asset = createMockAsset({
        user_metadata: { source_url: 'https://huggingface.co/org/model' }
      })
      const wrapper = mountPanel(asset)
      expect(wrapper.text()).toContain('Hugging Face')
    })

    it('does not render source field when source_url is absent', () => {
      const asset = createMockAsset()
      const wrapper = mountPanel(asset)
      const links = wrapper.findAll('a')
      expect(links).toHaveLength(0)
    })
  })

  describe('Model Tagging Section', () => {
    it('displays model type from tags', () => {
      const asset = createMockAsset({ tags: ['models', 'loras'] })
      const wrapper = mountPanel(asset)
      expect(wrapper.text()).toContain('loras')
    })

    it('extracts last segment from nested tag path', () => {
      const asset = createMockAsset({
        tags: ['models', 'checkpoints/sd15']
      })
      const wrapper = mountPanel(asset)
      expect(wrapper.text()).toContain('sd15')
    })

    it('displays base_model when present', () => {
      const asset = createMockAsset({
        user_metadata: { base_model: 'SDXL' }
      })
      const wrapper = mountPanel(asset)
      expect(wrapper.text()).toContain('SDXL')
    })

    it('renders additional tags as badges', () => {
      const asset = createMockAsset({
        user_metadata: { tags: ['anime', 'portrait', 'detailed'] }
      })
      const wrapper = mountPanel(asset)
      expect(wrapper.text()).toContain('anime')
      expect(wrapper.text()).toContain('portrait')
      expect(wrapper.text()).toContain('detailed')
    })
  })

  describe('Model Description Section', () => {
    it('renders trigger phrases when present', () => {
      const asset = createMockAsset({
        user_metadata: { trigger_phrases: ['trigger1', 'trigger2'] }
      })
      const wrapper = mountPanel(asset)
      expect(wrapper.text()).toContain('trigger1')
      expect(wrapper.text()).toContain('trigger2')
    })

    it('renders description when present', () => {
      const asset = createMockAsset({
        user_metadata: { description: 'A detailed model description' }
      })
      const wrapper = mountPanel(asset)
      expect(wrapper.text()).toContain('A detailed model description')
    })

    it('does not render trigger phrases field when empty', () => {
      const asset = createMockAsset()
      const wrapper = mountPanel(asset)
      expect(wrapper.text()).not.toContain(
        'assetBrowser.modelInfo.triggerPhrases'
      )
    })
  })

  describe('Accordion Structure', () => {
    it('renders three accordion sections', () => {
      const wrapper = mountPanel(createMockAsset())
      const accordions = wrapper.findAll('[data-testid="accordion-item"]')
      expect(accordions).toHaveLength(3)
    })

    it('renders correct section labels', () => {
      const wrapper = mountPanel(createMockAsset())
      const labels = wrapper.findAll('[data-testid="accordion-label"]')
      expect(labels[0].text()).toContain('assetBrowser.modelInfo.basicInfo')
      expect(labels[1].text()).toContain('assetBrowser.modelInfo.modelTagging')
      expect(labels[2].text()).toContain(
        'assetBrowser.modelInfo.modelDescription'
      )
    })
  })
})
