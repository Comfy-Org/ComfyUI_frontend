import { render, screen } from '@testing-library/vue'
import { createTestingPinia } from '@pinia/testing'
import PrimeVue from 'primevue/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { IsInstallingKey } from '@/workbench/extensions/manager/types/comfyManagerTypes'

import PackCardFooter from './PackCardFooter.vue'

// Mock the child components
vi.mock(
  '@/workbench/extensions/manager/components/manager/button/PackInstallButton.vue',
  () => ({
    default: { template: '<div data-testid="pack-install-button"></div>' }
  })
)

vi.mock(
  '@/workbench/extensions/manager/components/manager/button/PackEnableToggle.vue',
  () => ({
    default: { template: '<div data-testid="pack-enable-toggle"></div>' }
  })
)

// Mock composables
const mockIsPackInstalled = vi.fn()
const mockCheckNodeCompatibility = vi.fn()

vi.mock('@/workbench/extensions/manager/stores/comfyManagerStore', () => ({
  useComfyManagerStore: vi.fn(() => ({
    isPackInstalled: mockIsPackInstalled
  }))
}))

vi.mock(
  '@/workbench/extensions/manager/composables/useConflictDetection',
  () => ({
    useConflictDetection: vi.fn(() => ({
      checkNodeCompatibility: mockCheckNodeCompatibility
    }))
  })
)

const mockNodePack = {
  id: 'test-pack',
  name: 'Test Pack',
  downloads: 1000
}

describe('PackCardFooter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsPackInstalled.mockReset()
    mockCheckNodeCompatibility.mockReset()
  })

  function renderComponent(props = {}) {
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: { en: enMessages }
    })

    return render(PackCardFooter, {
      props: {
        nodePack: mockNodePack,
        ...props
      },
      global: {
        plugins: [PrimeVue, createTestingPinia({ stubActions: false }), i18n],
        provide: {
          [IsInstallingKey]: ref(false)
        }
      }
    })
  }

  describe('component rendering', () => {
    it('shows download count when available', () => {
      mockIsPackInstalled.mockReturnValue(false)
      mockCheckNodeCompatibility.mockReturnValue({
        hasConflict: false,
        conflicts: []
      })
      renderComponent()

      expect(screen.getByText('1,000')).toBeTruthy()
    })

    it('shows install button for uninstalled packages', () => {
      mockIsPackInstalled.mockReturnValue(false)
      mockCheckNodeCompatibility.mockReturnValue({
        hasConflict: false,
        conflicts: []
      })

      renderComponent()

      expect(screen.getByTestId('pack-install-button')).not.toBeNull()
      expect(screen.queryByTestId('pack-enable-toggle')).toBeNull()
    })

    it('shows enable toggle for installed packages', () => {
      mockIsPackInstalled.mockReturnValue(true)

      renderComponent()

      expect(screen.getByTestId('pack-enable-toggle')).not.toBeNull()
      expect(screen.queryByTestId('pack-install-button')).toBeNull()
    })
  })

  describe('conflict detection for uninstalled packages', () => {
    it('passes conflict info to install button when conflicts exist', () => {
      mockIsPackInstalled.mockReturnValue(false)
      mockCheckNodeCompatibility.mockReturnValue({
        hasConflict: true,
        conflicts: [
          {
            type: 'os_conflict',
            current_value: 'windows',
            required_value: 'linux'
          }
        ]
      })

      renderComponent()

      const installButton = screen.getByTestId('pack-install-button')
      expect(installButton).toBeTruthy()
      expect(installButton.hasAttribute('has-conflict')).toBe(true)
    })

    it('does not pass conflict info when no conflicts exist', () => {
      mockIsPackInstalled.mockReturnValue(false)
      mockCheckNodeCompatibility.mockReturnValue({
        hasConflict: false,
        conflicts: []
      })

      renderComponent()

      const installButton = screen.getByTestId('pack-install-button')
      expect(installButton).toBeTruthy()
      expect(installButton.getAttribute('has-conflict')).toBe('false')
    })
  })

  describe('installed packages', () => {
    it('does not pass has-conflict prop to enable toggle', () => {
      mockIsPackInstalled.mockReturnValue(true)

      renderComponent()

      const enableToggle = screen.getByTestId('pack-enable-toggle')
      expect(enableToggle).toBeTruthy()
      expect(enableToggle.hasAttribute('has-conflict')).toBe(false)
    })
  })
})
