/* oxlint-disable testing-library/no-node-access */
/* oxlint-disable testing-library/no-container */
/* oxlint-disable testing-library/prefer-user-event */
import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import PrimeVue from 'primevue/config'
import Tooltip from 'primevue/tooltip'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { useComfyManagerStore } from '@/workbench/extensions/manager/stores/comfyManagerStore'

import PackVersionBadge from './PackVersionBadge.vue'

// Mock config to prevent __COMFYUI_FRONTEND_VERSION__ error
vi.mock(import('@/config'), () => ({
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
  'test-pack': { ver: '1.5.0', cnr_id: 'test-pack', enabled: true },
  'installed-pack': { ver: '2.0.0', cnr_id: 'installed-pack', enabled: true }
}

vi.mock<unknown>(
  import('@/workbench/extensions/manager/composables/nodePack/usePackUpdateStatus'),

  () => ({
    usePackUpdateStatus: vi.fn(() => ({
      isUpdateAvailable: false
    }))
  })
)

const PackVersionSelectorPopoverStub = {
  name: 'PackVersionSelectorPopover',
  template:
    '<div><button data-testid="cancel-btn" @click="$emit(\'cancel\')">Cancel</button><button data-testid="submit-btn" @click="$emit(\'submit\')">Submit</button></div>',
  emits: ['cancel', 'submit']
}

describe('PackVersionBadge', () => {
  beforeEach(async () => {
    const store = useComfyManagerStore()
    store.installedPacks = mockInstalledPacks
    await nextTick()
    vi.mocked(useComfyManagerStore().isPackEnabled).mockReturnValue(true)
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
        plugins: [PrimeVue, i18n],
        directives: {
          tooltip: Tooltip
        },
        stubs: {
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

    expect(await screen.findByRole('dialog')).toBeVisible()
  })

  it('closes the popover when cancel is emitted', async () => {
    const user = userEvent.setup()
    renderComponent()

    await user.click(screen.getByRole('button', { name: /1\.5\.0/ }))
    await user.click(screen.getByTestId('cancel-btn'))
    await nextTick()

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes the popover when submit is emitted', async () => {
    const user = userEvent.setup()
    renderComponent()

    await user.click(screen.getByRole('button', { name: /1\.5\.0/ }))
    await user.click(screen.getByTestId('submit-btn'))
    await nextTick()

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  describe('selection state changes', () => {
    it('closes the popover when card is deselected', async () => {
      const { rerender } = renderComponent({
        props: { isSelected: true }
      })

      await userEvent
        .setup()
        .click(screen.getByRole('button', { name: /1\.5\.0/ }))
      expect(await screen.findByRole('dialog')).toBeVisible()
      await rerender({ nodePack: mockNodePack, isSelected: false })
      await nextTick()

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('does not close the popover when card is selected', async () => {
      const { rerender } = renderComponent({
        props: { isSelected: false }
      })

      await userEvent
        .setup()
        .click(screen.getByRole('button', { name: /1\.5\.0/ }))
      await rerender({ nodePack: mockNodePack, isSelected: true })
      await nextTick()

      expect(screen.getByRole('dialog')).toBeVisible()
    })

    it('does not close the popover when isSelected remains false', async () => {
      const { rerender } = renderComponent({
        props: { isSelected: false }
      })

      await userEvent
        .setup()
        .click(screen.getByRole('button', { name: /1\.5\.0/ }))
      await rerender({ nodePack: mockNodePack, isSelected: false })
      await nextTick()

      expect(screen.getByRole('dialog')).toBeVisible()
    })

    it('does not close the popover when isSelected remains true', async () => {
      const { rerender } = renderComponent({
        props: { isSelected: true }
      })

      await userEvent
        .setup()
        .click(screen.getByRole('button', { name: /1\.5\.0/ }))
      await rerender({ nodePack: mockNodePack, isSelected: true })
      await nextTick()

      expect(screen.getByRole('dialog')).toBeVisible()
    })
  })

  describe('disabled state', () => {
    beforeEach(() => {
      vi.mocked(useComfyManagerStore().isPackEnabled).mockReturnValue(false)
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

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
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

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })
})
