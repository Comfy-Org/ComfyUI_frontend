import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import CanvasModeSelector from '@/components/graph/CanvasModeSelector.vue'

const mockExecute = vi.fn()
const mockGetCommand = vi.fn().mockReturnValue({
  keybinding: {
    combo: {
      getKeySequences: () => ['V']
    }
  }
})
const mockFormatKeySequence = vi.fn().mockReturnValue('V')

vi.mock('@/stores/commandStore', () => ({
  useCommandStore: () => ({
    execute: mockExecute,
    getCommand: mockGetCommand,
    formatKeySequence: mockFormatKeySequence
  })
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    canvas: { read_only: false }
  })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      graphCanvasMenu: {
        select: 'Select',
        hand: 'Hand',
        canvasMode: 'Canvas Mode'
      }
    }
  }
})

const mockPopoverHide = vi.fn()

function renderComponent() {
  const user = userEvent.setup()
  render(CanvasModeSelector, {
    global: {
      plugins: [i18n],
      stubs: {
        Popover: {
          template: '<div><slot /></div>',
          methods: {
            toggle: vi.fn(),
            hide: mockPopoverHide
          }
        }
      }
    }
  })
  return { user }
}

describe('CanvasModeSelector', () => {
  it('should render menu with menuitemradio roles and aria-checked', () => {
    renderComponent()

    expect(screen.getByRole('menu')).toBeInTheDocument()

    const menuItems = screen.getAllByRole('menuitemradio')
    expect(menuItems).toHaveLength(2)

    expect(menuItems[0]).toHaveAttribute('aria-checked', 'true')
    expect(menuItems[1]).toHaveAttribute('aria-checked', 'false')
  })

  it('should render menu items as buttons with aria-labels', () => {
    renderComponent()

    const menuItems = screen.getAllByRole('menuitemradio')
    menuItems.forEach((item) => {
      expect(item.tagName).toBe('BUTTON')
      expect(item).toHaveAttribute('type', 'button')
    })
    expect(menuItems[0]).toHaveAttribute('aria-label', 'Select')
    expect(menuItems[1]).toHaveAttribute('aria-label', 'Hand')
  })

  it('should use roving tabindex based on active mode', () => {
    renderComponent()

    const menuItems = screen.getAllByRole('menuitemradio')
    expect(menuItems[0]).toHaveAttribute('tabindex', '0')
    expect(menuItems[1]).toHaveAttribute('tabindex', '-1')
  })

  it('should mark icons as aria-hidden', () => {
    renderComponent()

    const menuItems = screen.getAllByRole('menuitemradio')
    menuItems.forEach((item) => {
      // eslint-disable-next-line testing-library/no-node-access
      const icons = item.querySelectorAll('i')
      icons.forEach((icon) => {
        expect(icon).toHaveAttribute('aria-hidden', 'true')
      })
    })
  })

  it('should expose trigger button with aria-haspopup and aria-expanded', () => {
    renderComponent()

    const trigger = screen.getByRole('button', { name: 'Canvas Mode' })
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('should call focus on next item when ArrowDown is pressed', async () => {
    const { user } = renderComponent()

    const menuItems = screen.getAllByRole('menuitemradio')
    const focusSpy = vi.spyOn(menuItems[1], 'focus')

    menuItems[0].focus()
    await user.keyboard('{ArrowDown}')
    expect(focusSpy).toHaveBeenCalled()
  })

  it('should call focus on previous item when ArrowUp is pressed', async () => {
    const { user } = renderComponent()

    const menuItems = screen.getAllByRole('menuitemradio')
    const focusSpy = vi.spyOn(menuItems[0], 'focus')

    menuItems[1].focus()
    await user.keyboard('{ArrowUp}')
    expect(focusSpy).toHaveBeenCalled()
  })

  it('should close popover on Escape and restore focus to trigger', async () => {
    const { user } = renderComponent()

    const menuItems = screen.getAllByRole('menuitemradio')
    const trigger = screen.getByRole('button', { name: 'Canvas Mode' })
    const focusSpy = vi.spyOn(trigger, 'focus')

    menuItems[0].focus()
    await user.keyboard('{Escape}')
    expect(mockPopoverHide).toHaveBeenCalled()
    expect(focusSpy).toHaveBeenCalled()
  })
})
