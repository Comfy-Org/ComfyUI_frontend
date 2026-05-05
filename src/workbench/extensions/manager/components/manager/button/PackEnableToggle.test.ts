import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import PrimeVue from 'primevue/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { useComfyManagerStore } from '@/workbench/extensions/manager/stores/comfyManagerStore'

import PackEnableToggle from './PackEnableToggle.vue'

// Mock debounce to execute immediately
vi.mock('es-toolkit/compat', async () => {
  const actual = await vi.importActual('es-toolkit/compat')
  return {
    ...actual,
    debounce: <T extends (...args: unknown[]) => unknown>(fn: T) => fn
  }
})

const ToggleSwitchStub = defineComponent({
  name: 'ToggleSwitch',
  props: {
    modelValue: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    readonly: { type: Boolean, default: false },
    ariaLabel: { type: String, default: '' }
  },
  emits: ['update:modelValue', 'focus'],
  template: `<div data-testid="toggle-switch" :data-model-value="String(modelValue)" :data-disabled="String(disabled)">
    <button data-testid="toggle-true" @click="$emit('update:modelValue', true)">on</button>
    <button data-testid="toggle-false" @click="$emit('update:modelValue', false)">off</button>
  </div>`
})

const mockNodePack = {
  id: 'test-pack',
  name: 'Test Pack',
  latest_version: {
    version: '1.0.0',
    createdAt: '2023-01-01T00:00:00Z'
  }
}

const mockIsPackEnabled = vi.fn()
const mockEnablePack = vi.fn().mockResolvedValue(undefined)
const mockDisablePack = vi.fn().mockResolvedValue(undefined)
const mockGetConflictsForPackageByID = vi.fn()

vi.mock('@/workbench/extensions/manager/stores/comfyManagerStore', () => ({
  useComfyManagerStore: vi.fn(() => ({
    isPackEnabled: mockIsPackEnabled,
    enablePack: mockEnablePack,
    disablePack: mockDisablePack,
    installedPacks: {}
  }))
}))

vi.mock('@/workbench/extensions/manager/stores/conflictDetectionStore', () => ({
  useConflictDetectionStore: vi.fn(() => ({
    getConflictsForPackageByID: mockGetConflictsForPackageByID
  }))
}))

describe('PackEnableToggle', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
    mockIsPackEnabled.mockReset()
    mockEnablePack.mockReset().mockResolvedValue(undefined)
    mockDisablePack.mockReset().mockResolvedValue(undefined)
  })

  function renderComponent({
    props = {},
    installedPacks = {}
  }: {
    props?: Record<string, unknown>
    installedPacks?: Record<string, unknown>
  } = {}) {
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: { en: enMessages }
    })

    vi.mocked(useComfyManagerStore).mockReturnValue({
      isPackEnabled: mockIsPackEnabled,
      enablePack: mockEnablePack,
      disablePack: mockDisablePack,
      installedPacks
    } as Partial<ReturnType<typeof useComfyManagerStore>> as ReturnType<
      typeof useComfyManagerStore
    >)

    return render(PackEnableToggle, {
      props: {
        nodePack: mockNodePack,
        ...props
      },
      global: {
        plugins: [PrimeVue, createTestingPinia({ stubActions: false }), i18n],
        stubs: {
          ToggleSwitch: ToggleSwitchStub
        }
      }
    })
  }

  it('renders a toggle switch', () => {
    mockIsPackEnabled.mockReturnValue(true)
    renderComponent()

    expect(screen.getByTestId('toggle-switch')).toBeInTheDocument()
  })

  it('checks if pack is enabled on mount', () => {
    mockIsPackEnabled.mockReturnValue(true)
    renderComponent()

    expect(mockIsPackEnabled).toHaveBeenCalledWith(mockNodePack.id)
  })

  it('sets toggle to on when pack is enabled', () => {
    mockIsPackEnabled.mockReturnValue(true)
    renderComponent()

    expect(screen.getByTestId('toggle-switch')).toHaveAttribute(
      'data-model-value',
      'true'
    )
  })

  it('sets toggle to off when pack is disabled', () => {
    mockIsPackEnabled.mockReturnValue(false)
    renderComponent()

    expect(screen.getByTestId('toggle-switch')).toHaveAttribute(
      'data-model-value',
      'false'
    )
  })

  it('calls enablePack when toggle is switched on', async () => {
    mockIsPackEnabled.mockReturnValue(false)
    renderComponent()

    await user.click(screen.getByTestId('toggle-true'))

    expect(mockEnablePack).toHaveBeenCalledWith(
      expect.objectContaining({
        id: mockNodePack.id,
        version: mockNodePack.latest_version.version
      })
    )
  })

  it('calls disablePack when toggle is switched off', async () => {
    mockIsPackEnabled.mockReturnValue(true)
    renderComponent()

    await user.click(screen.getByTestId('toggle-false'))

    expect(mockDisablePack).toHaveBeenCalledWith(
      expect.objectContaining({
        id: mockNodePack.id,
        version: mockNodePack.latest_version.version
      })
    )
  })

  it('disables toggle while loading', async () => {
    const pendingPromise = new Promise<void>((resolve) => {
      setTimeout(() => resolve(), 1000)
    })
    mockEnablePack.mockReturnValue(pendingPromise)

    mockIsPackEnabled.mockReturnValue(false)
    renderComponent()

    await user.click(screen.getByTestId('toggle-true'))
    await nextTick()
    expect(screen.getByTestId('toggle-switch')).toHaveAttribute(
      'data-disabled',
      'true'
    )

    await pendingPromise
    await nextTick()
    expect(screen.getByTestId('toggle-switch')).toHaveAttribute(
      'data-disabled',
      'false'
    )
  })

  describe('conflict warning icon', () => {
    it('should show warning icon when package has conflicts', () => {
      mockGetConflictsForPackageByID.mockReturnValue({
        package_id: 'test-pack',
        package_name: 'Test Pack',
        has_conflict: true,
        conflicts: [
          {
            type: 'import_failed',
            current_value: 'installed',
            required_value: 'error message'
          }
        ],
        is_compatible: false
      })

      mockIsPackEnabled.mockReturnValue(true)
      const { container } = renderComponent()

      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const warningIcon = container.querySelector(
        '.icon-\\[lucide--triangle-alert\\]'
      )
      expect(warningIcon).not.toBeNull()
      expect(warningIcon).toHaveClass('text-warning-background')
    })

    it('should not show warning icon when package has no conflicts', () => {
      mockGetConflictsForPackageByID.mockReturnValue(null)

      mockIsPackEnabled.mockReturnValue(true)
      const { container } = renderComponent()

      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const warningIcon = container.querySelector(
        '.icon-\\[lucide--triangle-alert\\]'
      )
      expect(warningIcon).toBeNull()
    })
  })
})
