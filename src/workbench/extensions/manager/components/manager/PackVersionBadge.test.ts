/* eslint-disable testing-library/no-node-access */
/* eslint-disable testing-library/no-container */
/* eslint-disable testing-library/prefer-user-event */
import { createTestingPinia } from '@pinia/testing'
import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import PrimeVue from 'primevue/config'
import Tooltip from 'primevue/tooltip'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import PackVersionBadge from './PackVersionBadge.vue'

// Mock config to prevent __COMFYUI_FRONTEND_VERSION__ error
vi.mock('@/config', () => ({
  default: {
    app_title: 'ComfyUI',
    app_version: '1.0.0'
  }
}))

const mockNodePack = {
  id: 'test-pack',
  name: 'Test Pack',
  latest_version: {
    version: '1.0.0'
  }
}

const mockInstalledPacks = {
  'test-pack': { ver: '1.5.0' },
  'installed-pack': { ver: '2.0.0' }
}

const mockIsPackEnabled = vi.fn(() => true)

vi.mock('@/workbench/extensions/manager/stores/comfyManagerStore', () => ({
  useComfyManagerStore: vi.fn(() => ({
    installedPacks: mockInstalledPacks,
    isPackInstalled: (id: string) =>
      !!mockInstalledPacks[id as keyof typeof mockInstalledPacks],
    isPackEnabled: mockIsPackEnabled,
    getInstalledPackVersion: (id: string) =>
      mockInstalledPacks[id as keyof typeof mockInstalledPacks]?.ver
  }))
}))

vi.mock(
  '@/workbench/extensions/manager/composables/nodePack/usePackUpdateStatus',
  () => ({
    usePackUpdateStatus: vi.fn(() => ({
      isUpdateAvailable: false
    }))
  })
)

const mockToggle = vi.fn()
const mockHide = vi.fn()
const PopoverStub = {
  name: 'Popover',
  template: '<div><slot></slot></div>',
  methods: {
    toggle: mockToggle,
    hide: mockHide
  }
}

const PackVersionSelectorPopoverStub = {
  name: 'PackVersionSelectorPopover',
  template:
    '<div><button data-testid="cancel-btn" @click="$emit(\'cancel\')">Cancel</button><button data-testid="submit-btn" @click="$emit(\'submit\')">Submit</button></div>',
  emits: ['cancel', 'submit']
}

describe('PackVersionBadge', () => {
  beforeEach(() => {
    mockToggle.mockReset()
    mockHide.mockReset()
    mockIsPackEnabled.mockReturnValue(true)
  })

  function renderComponent({
    props = {}
  }: { props?: Record<string, unknown> } = {}) {
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: { en: enMessages }
    })

    return render(PackVersionBadge, {
      props: {
        nodePack: mockNodePack,
        isSelected: false,
        ...props
      },
      global: {
        plugins: [PrimeVue, createTestingPinia({ stubActions: false }), i18n],
        directives: {
          tooltip: Tooltip
        },
        stubs: {
          Popover: PopoverStub,
          PackVersionSelectorPopover: PackVersionSelectorPopoverStub
        }
      }
    })
  }

  it('renders with installed version from store', () => {
    renderComponent()

    expect(screen.getByRole('button', { name: /1\.5\.0/ })).toBeInTheDocument()
  })

  it('falls back to latest_version when not installed', () => {
    const uninstalledPack = {
      id: 'uninstalled-pack',
      name: 'Uninstalled Pack',
      latest_version: {
        version: '3.0.0'
      }
    }

    renderComponent({
      props: { nodePack: uninstalledPack }
    })

    expect(screen.getByRole('button', { name: /3\.0\.0/ })).toBeInTheDocument()
  })

  it('falls back to NIGHTLY when no latest_version and not installed', () => {
    const noVersionPack = {
      id: 'no-version-pack',
      name: 'No Version Pack'
    }

    renderComponent({
      props: { nodePack: noVersionPack }
    })

    expect(screen.getByRole('button', { name: /nightly/ })).toBeInTheDocument()
  })

  it('falls back to NIGHTLY when nodePack.id is missing', () => {
    const invalidPack = {
      name: 'Invalid Pack'
    }

    renderComponent({
      props: { nodePack: invalidPack }
    })

    expect(screen.getByRole('button', { name: /nightly/ })).toBeInTheDocument()
  })

  it('toggles the popover when button is clicked', async () => {
    const user = userEvent.setup()
    renderComponent()

    await user.click(screen.getByRole('button', { name: /1\.5\.0/ }))

    expect(mockToggle).toHaveBeenCalled()
  })

  it('closes the popover when cancel is emitted', async () => {
    const user = userEvent.setup()
    renderComponent()

    await user.click(screen.getByTestId('cancel-btn'))
    await nextTick()

    expect(mockHide).toHaveBeenCalled()
  })

  it('closes the popover when submit is emitted', async () => {
    const user = userEvent.setup()
    renderComponent()

    await user.click(screen.getByTestId('submit-btn'))
    await nextTick()

    expect(mockHide).toHaveBeenCalled()
  })

  describe('selection state changes', () => {
    it('closes the popover when card is deselected', async () => {
      const { rerender } = renderComponent({
        props: { isSelected: true }
      })

      await rerender({ nodePack: mockNodePack, isSelected: false })
      await nextTick()

      expect(mockHide).toHaveBeenCalled()
    })

    it('does not close the popover when card is selected', async () => {
      const { rerender } = renderComponent({
        props: { isSelected: false }
      })

      await rerender({ nodePack: mockNodePack, isSelected: true })
      await nextTick()

      expect(mockHide).not.toHaveBeenCalled()
    })

    it('does not close the popover when isSelected remains false', async () => {
      const { rerender } = renderComponent({
        props: { isSelected: false }
      })

      await rerender({ nodePack: mockNodePack, isSelected: false })
      await nextTick()

      expect(mockHide).not.toHaveBeenCalled()
    })

    it('does not close the popover when isSelected remains true', async () => {
      const { rerender } = renderComponent({
        props: { isSelected: true }
      })

      await rerender({ nodePack: mockNodePack, isSelected: true })
      await nextTick()

      expect(mockHide).not.toHaveBeenCalled()
    })
  })

  describe('disabled state', () => {
    beforeEach(() => {
      mockIsPackEnabled.mockReturnValue(false)
    })

    it('adds disabled styles when pack is disabled', () => {
      const { container } = renderComponent()

      const badge = container.querySelector('[role="text"]')
      expect(badge).toBeInTheDocument()
      expect(badge).toHaveClass('cursor-not-allowed', 'opacity-60')
    })

    it('does not show chevron icon when disabled', () => {
      const { container } = renderComponent()

      const chevronIcon = container.querySelector('.pi-chevron-right')
      expect(chevronIcon).not.toBeInTheDocument()
    })

    it('does not show update arrow when disabled', () => {
      const { container } = renderComponent()

      const updateIcon = container.querySelector('.pi-arrow-circle-up')
      expect(updateIcon).not.toBeInTheDocument()
    })

    it('does not toggle popover when clicked while disabled', async () => {
      const { container } = renderComponent()

      const badge = container.querySelector('[role="text"]')!
      await fireEvent.click(badge)

      expect(mockToggle).not.toHaveBeenCalled()
    })

    it('has correct tabindex when disabled', () => {
      const { container } = renderComponent()

      const badge = container.querySelector('[role="text"]')
      expect(badge).toBeInTheDocument()
      expect(badge).toHaveAttribute('tabindex', '-1')
    })

    it('does not respond to keyboard events when disabled', async () => {
      const { container } = renderComponent()

      const badge = container.querySelector('[role="text"]')!
      await fireEvent.keyDown(badge, { key: 'Enter' })
      await fireEvent.keyDown(badge, { key: ' ' })

      expect(mockToggle).not.toHaveBeenCalled()
    })
  })
})
