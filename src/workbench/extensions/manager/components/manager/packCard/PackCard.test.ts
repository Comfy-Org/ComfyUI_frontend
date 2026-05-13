import { createTestingPinia } from '@pinia/testing'
import ProgressSpinner from 'primevue/progressspinner'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { render, screen } from '@testing-library/vue'

import PackCard from '@/workbench/extensions/manager/components/manager/packCard/PackCard.vue'
import type {
  MergedNodePack,
  RegistryPack
} from '@/workbench/extensions/manager/types/comfyManagerTypes'

const translateMock = vi.hoisted(() =>
  vi.fn((key: string, choice?: number) =>
    typeof choice === 'number' ? `${key}-${choice}` : key
  )
)
const dateMock = vi.hoisted(() => vi.fn(() => '2024. 1. 1.'))
const storageMap = vi.hoisted(() => new Map<string, unknown>())

// Mock dependencies
vi.mock('vue-i18n', () => ({
  useI18n: vi.fn(() => ({
    d: dateMock,
    t: translateMock
  })),
  createI18n: vi.fn(() => ({
    global: {
      t: translateMock,
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

vi.mock('@vueuse/core', () => ({
  whenever: vi.fn(),
  useStorage: vi.fn((key: string, defaultValue: unknown) => {
    if (!storageMap.has(key)) storageMap.set(key, defaultValue)
    return storageMap.get(key)
  }),
  createSharedComposable: vi.fn((fn) => {
    let cached: ReturnType<typeof fn>
    return (...args: Parameters<typeof fn>) => (cached ??= fn(...args))
  })
}))

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
  beforeEach(() => {
    vi.clearAllMocks()
    storageMap.clear()
  })

  function renderComponent(props: {
    nodePack: MergedNodePack | RegistryPack
    isSelected?: boolean
  }) {
    return render(PackCard, {
      props,
      global: {
        plugins: [createTestingPinia({ stubActions: false })],
        components: {
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
      renderComponent({ nodePack: mockNodePack })

      expect(screen.getByText('Test Package')).toBeInTheDocument()
      expect(screen.getByText('Test package description')).toBeInTheDocument()
      expect(screen.getByText('Test Author')).toBeInTheDocument()
    })

    it('should render date correctly', () => {
      renderComponent({ nodePack: mockNodePack })

      expect(screen.getByText('2024. 1. 1.')).toBeInTheDocument()
    })

    it('should apply selected ring when isSelected is true', () => {
      const { container } = renderComponent({
        nodePack: mockNodePack,
        isSelected: true
      })

      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- CSS class has no ARIA role
      expect(container.querySelector('.ring-3')).toBeInTheDocument()
    })

    it('should not apply selected ring when isSelected is false', () => {
      const { container } = renderComponent({
        nodePack: mockNodePack,
        isSelected: false
      })

      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- CSS class has no ARIA role
      expect(container.querySelector('.ring-3')).not.toBeInTheDocument()
    })
  })

  describe('component behavior', () => {
    it('should render without errors', () => {
      const { container } = renderComponent({ nodePack: mockNodePack })

      // eslint-disable-next-line testing-library/no-node-access -- structural root element check
      expect(container.firstElementChild).toBeInTheDocument()
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- CSS class has no ARIA role
      expect(container.querySelector('.rounded-lg')).toBeInTheDocument()
    })
  })

  describe('package information display', () => {
    it('should display package name', () => {
      renderComponent({ nodePack: mockNodePack })

      expect(screen.getByText('Test Package')).toBeInTheDocument()
    })

    it('should display package description', () => {
      renderComponent({ nodePack: mockNodePack })

      expect(screen.getByText('Test package description')).toBeInTheDocument()
    })

    it('should display author name', () => {
      renderComponent({ nodePack: mockNodePack })

      expect(screen.getByText('Test Author')).toBeInTheDocument()
    })

    it('should handle missing description', () => {
      const packWithoutDescription = {
        ...mockNodePack,
        description: undefined
      }
      const { container } = renderComponent({
        nodePack: packWithoutDescription
      })

      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- <p> has no implicit ARIA role
      expect(container.querySelector('p')).not.toBeInTheDocument()
    })

    it('should handle missing author', () => {
      const packWithoutAuthor = { ...mockNodePack, author: undefined }
      const { container } = renderComponent({ nodePack: packWithoutAuthor })

      // eslint-disable-next-line testing-library/no-node-access -- structural root element check
      expect(container.firstElementChild).toBeInTheDocument()
    })

    it('should use localized singular/plural nodes label', () => {
      const packWithNodes = {
        ...mockNodePack,
        comfy_nodes: ['node-a']
      } as MergedNodePack

      renderComponent({ nodePack: packWithNodes })

      expect(screen.getByText('g.nodesCount-1')).toBeInTheDocument()
      expect(translateMock).toHaveBeenCalledWith('g.nodesCount', 1)
    })
  })

  describe('component structure', () => {
    it('should render PackBanner component', () => {
      const { container } = renderComponent({ nodePack: mockNodePack })

      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- stub component tag has no ARIA role
      const banner = container.querySelector('pack-banner-stub')
      expect(banner).toBeInTheDocument()
    })

    it('should render PackVersionBadge component', () => {
      const { container } = renderComponent({ nodePack: mockNodePack })

      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- stub component tag has no ARIA role
      const badge = container.querySelector('pack-version-badge-stub')
      expect(badge).toBeInTheDocument()
    })

    it('should render PackCardFooter component', () => {
      const { container } = renderComponent({ nodePack: mockNodePack })

      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- stub component tag has no ARIA role
      const footer = container.querySelector('pack-card-footer-stub')
      expect(footer).toBeInTheDocument()
    })
  })
})
