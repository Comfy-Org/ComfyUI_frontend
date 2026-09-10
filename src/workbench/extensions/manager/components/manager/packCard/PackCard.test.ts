import ProgressSpinner from 'primevue/progressspinner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { render, screen } from '@testing-library/vue'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { useSystemStatsStore } from '@/stores/systemStatsStore'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'
import PackCard from '@/workbench/extensions/manager/components/manager/packCard/PackCard.vue'
import type {
  MergedNodePack,
  RegistryPack
} from '@/workbench/extensions/manager/types/comfyManagerTypes'

vi.mock<unknown>(import('@/config'), () => ({
  default: {
    app_version: '1.24.0-1'
  }
}))

describe('PackCard', () => {
  beforeEach(() => {
    useSystemStatsStore().systemStats = {
      system: {
        os: 'Darwin',
        ram_total: 0,
        ram_free: 0,
        comfyui_version: '0.3.41',
        python_version: '3.11',
        pytorch_version: '2.1',
        embedded_python: false,
        argv: []
      },
      devices: [
        {
          type: 'mps',
          name: 'Metal',
          index: 0,
          vram_total: 0,
          vram_free: 0,
          torch_vram_total: 0,
          torch_vram_free: 0
        }
      ]
    }
    useColorPaletteStore().activePaletteId = 'light'
  })

  function renderComponent(props: {
    nodePack: MergedNodePack | RegistryPack
    isSelected?: boolean
  }) {
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: { en: enMessages }
    })

    return render(PackCard, {
      props,
      global: {
        plugins: [i18n],
        components: {
          ProgressSpinner
        },
        stubs: {
          PackBanner: true,
          PackVersionBadge: true,
          PackCardFooter: true
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
  }

  describe('basic rendering', () => {
    it('should render package card with basic information', () => {
      renderComponent({ nodePack: mockNodePack })

      expect(screen.getByText('Test Package')).toBeInTheDocument()
      expect(screen.getByText('Test package description')).toBeInTheDocument()
      expect(screen.getByText('Test Author')).toBeInTheDocument()
    })

    it('should render date correctly', () => {
      renderComponent({ nodePack: mockNodePack })

      expect(screen.getByText('Jan 1, 2024')).toBeInTheDocument()
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

      expect(screen.getByText('1 node')).toBeInTheDocument()
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
