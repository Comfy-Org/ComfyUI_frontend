import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import Card from 'primevue/card'
import ProgressSpinner from 'primevue/progressspinner'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import PackCard from '@/workbench/extensions/manager/components/manager/packCard/PackCard.vue'
import type {
  MergedNodePack,
  RegistryPack
} from '@/workbench/extensions/manager/types/comfyManagerTypes'

// Mock dependencies
vi.mock('vue-i18n', () => ({
  useI18n: vi.fn(() => ({
    d: vi.fn(() => '2024. 1. 1.'),
    t: vi.fn((key: string) => key)
  })),
  createI18n: vi.fn(() => ({
    global: {
      t: vi.fn((key: string) => key),
      te: vi.fn(() => true)
    }
  }))
}))

vi.mock('@/workbench/extensions/manager/stores/comfyManagerStore', () => ({
  useComfyManagerStore: vi.fn(() => ({
    isPackInstalled: vi.fn(() => false),
    isPackEnabled: vi.fn(() => true),
    isPackInstalling: vi.fn(() => false),
    installedPacksIds: []
  }))
}))

vi.mock('@/stores/workspace/colorPaletteStore', () => ({
  useColorPaletteStore: vi.fn(() => ({
    completedActivePalette: { light_theme: true }
  }))
}))

vi.mock('@vueuse/core', async () => {
  const { ref } = await import('vue')
  return {
    whenever: vi.fn(),
    useStorage: vi.fn((_key, defaultValue) => {
      return ref(defaultValue)
    }),
    createSharedComposable: vi.fn((fn) => fn)
  }
})

vi.mock('@/config', () => ({
  default: {
    app_version: '1.24.0-1'
  }
}))

vi.mock('@/stores/systemStatsStore', () => ({
  useSystemStatsStore: vi.fn(() => ({
    systemStats: {
      system: { os: 'Darwin' },
      devices: [{ type: 'mps', name: 'Metal' }]
    }
  }))
}))

describe('PackCard', () => {
  let pinia: ReturnType<typeof createPinia>

  beforeEach(() => {
    vi.clearAllMocks()
    pinia = createPinia()
    setActivePinia(pinia)
  })

  const createWrapper = (props: {
    nodePack: MergedNodePack | RegistryPack
    isSelected?: boolean
  }) => {
    const wrapper = mount(PackCard, {
      props,
      global: {
        plugins: [pinia],
        components: {
          Card,
          ProgressSpinner
        },
        stubs: {
          PackBanner: true,
          PackVersionBadge: true,
          PackCardFooter: true
        },
        mocks: {
          $t: vi.fn((key: string) => key)
        }
      }
    })

    return wrapper
  }

  const mockNodePack: RegistryPack = {
    id: 'test-package',
    name: 'Test Package',
    description: 'Test package description',
    author: 'Test Author',
    latest_version: {
      createdAt: '2024-01-01T00:00:00Z'
    }
  } as RegistryPack

  describe('basic rendering', () => {
    it('should render package card with basic information', () => {
      const wrapper = createWrapper({ nodePack: mockNodePack })

      expect(wrapper.find('.p-card').exists()).toBe(true)
      expect(wrapper.text()).toContain('Test Package')
      expect(wrapper.text()).toContain('Test package description')
      expect(wrapper.text()).toContain('Test Author')
    })

    it('should render date correctly', () => {
      const wrapper = createWrapper({ nodePack: mockNodePack })

      expect(wrapper.text()).toContain('2024. 1. 1.')
    })

    it('should apply selected class when isSelected is true', () => {
      const wrapper = createWrapper({
        nodePack: mockNodePack,
        isSelected: true
      })

      expect(wrapper.find('.selected-card').exists()).toBe(true)
    })

    it('should not apply selected class when isSelected is false', () => {
      const wrapper = createWrapper({
        nodePack: mockNodePack,
        isSelected: false
      })

      expect(wrapper.find('.selected-card').exists()).toBe(false)
    })
  })

  describe('component behavior', () => {
    it('should render without errors', () => {
      const wrapper = createWrapper({ nodePack: mockNodePack })

      expect(wrapper.exists()).toBe(true)
      expect(wrapper.find('.p-card').exists()).toBe(true)
    })
  })

  describe('package information display', () => {
    it('should display package name', () => {
      const wrapper = createWrapper({ nodePack: mockNodePack })

      expect(wrapper.text()).toContain('Test Package')
    })

    it('should display package description', () => {
      const wrapper = createWrapper({ nodePack: mockNodePack })

      expect(wrapper.text()).toContain('Test package description')
    })

    it('should display author name', () => {
      const wrapper = createWrapper({ nodePack: mockNodePack })

      expect(wrapper.text()).toContain('Test Author')
    })

    it('should handle missing description', () => {
      const packWithoutDescription = { ...mockNodePack, description: undefined }
      const wrapper = createWrapper({ nodePack: packWithoutDescription })

      expect(wrapper.find('p').exists()).toBe(false)
    })

    it('should handle missing author', () => {
      const packWithoutAuthor = { ...mockNodePack, author: undefined }
      const wrapper = createWrapper({ nodePack: packWithoutAuthor })

      // Should still render without errors
      expect(wrapper.exists()).toBe(true)
    })
  })

  describe('component structure', () => {
    it('should render PackBanner component', () => {
      const wrapper = createWrapper({ nodePack: mockNodePack })

      expect(wrapper.find('pack-banner-stub').exists()).toBe(true)
    })

    it('should render PackVersionBadge component', () => {
      const wrapper = createWrapper({ nodePack: mockNodePack })

      expect(wrapper.find('pack-version-badge-stub').exists()).toBe(true)
    })

    it('should render PackCardFooter component', () => {
      const wrapper = createWrapper({ nodePack: mockNodePack })

      expect(wrapper.find('pack-card-footer-stub').exists()).toBe(true)
    })
  })

  describe('styling', () => {
    it('should have correct CSS classes', () => {
      const wrapper = createWrapper({ nodePack: mockNodePack })

      const card = wrapper.find('.p-card')
      expect(card.classes()).toContain('w-full')
      expect(card.classes()).toContain('h-full')
      expect(card.classes()).toContain('rounded-lg')
    })

    it('should have correct base styling', () => {
      const wrapper = createWrapper({ nodePack: mockNodePack })

      const card = wrapper.find('.p-card')
      // Check the actual classes applied to the card
      expect(card.classes()).toContain('p-card')
      expect(card.classes()).toContain('p-component')
      expect(card.classes()).toContain('inline-flex')
      expect(card.classes()).toContain('flex-col')
    })
  })
})
