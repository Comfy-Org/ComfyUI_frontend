import userEvent from '@testing-library/user-event'
import { fireEvent, render, screen } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import CanvasModeSelector from '@/components/graph/CanvasModeSelector.vue'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCommandStore } from '@/stores/commandStore'

beforeEach(() => {
  useCanvasStore().canvas = fromPartial({ read_only: false })
  vi.mocked(useCommandStore().execute).mockResolvedValue(undefined)
  for (const id of ['Comfy.Canvas.Unlock', 'Comfy.Canvas.Lock']) {
    useCommandStore().registerCommand({ id, function: vi.fn() })
  }
})

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

function renderComponent() {
  const user = userEvent.setup()
  render(CanvasModeSelector, {
    global: {
      plugins: [i18n]
    }
  })
  return { user }
}

async function openMenu() {
  const { user } = renderComponent()
  await user.click(screen.getByRole('button', { name: 'Canvas Mode' }))
  await screen.findByRole('menu')
  return { user }
}

describe('CanvasModeSelector', () => {
  it.for([
    { event: 'resize', target: window },
    { event: 'scroll', target: document }
  ])(
    'dismisses on viewport $event but not menu scrolling',
    async ({ event, target }) => {
      await openMenu()
      await fireEvent.scroll(screen.getByRole('menu'))
      expect(screen.getByRole('menu')).toBeInTheDocument()

      await fireEvent(target, new Event(event))
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    }
  )

  it('focuses the selected mode and restores trigger focus after choosing another', async () => {
    const { user } = await openMenu()
    expect(screen.getByRole('menuitemradio', { name: 'Select' })).toHaveFocus()

    await user.click(screen.getByRole('menuitemradio', { name: 'Hand' }))

    expect(useCommandStore().execute).toHaveBeenCalledWith('Comfy.Canvas.Lock')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Canvas Mode' })).toHaveFocus()
  })

  it('should render menu with menuitemradio roles and aria-checked', async () => {
    await openMenu()

    expect(screen.getByRole('menu')).toBeInTheDocument()

    const menuItems = screen.getAllByRole('menuitemradio')
    expect(menuItems).toHaveLength(2)

    expect(menuItems[0]).toHaveAttribute('aria-checked', 'true')
    expect(menuItems[1]).toHaveAttribute('aria-checked', 'false')
  })

  it('should render menu items as buttons with aria-labels', async () => {
    await openMenu()

    const menuItems = screen.getAllByRole('menuitemradio')
    menuItems.forEach((item) => {
      expect(item.tagName).toBe('BUTTON')
      expect(item).toHaveAttribute('type', 'button')
    })
    expect(menuItems[0]).toHaveAttribute('aria-label', 'Select')
    expect(menuItems[1]).toHaveAttribute('aria-label', 'Hand')
  })

  it('should use roving tabindex based on active mode', async () => {
    await openMenu()

    const menuItems = screen.getAllByRole('menuitemradio')
    expect(menuItems[0]).toHaveAttribute('tabindex', '0')
    expect(menuItems[1]).toHaveAttribute('tabindex', '-1')
  })

  it('should mark icons as aria-hidden', async () => {
    await openMenu()

    const menuItems = screen.getAllByRole('menuitemradio')
    menuItems.forEach((item) => {
      // oxlint-disable-next-line testing-library/no-node-access
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
    const { user } = await openMenu()

    const menuItems = screen.getAllByRole('menuitemradio')
    const focusSpy = vi.spyOn(menuItems[1], 'focus')

    menuItems[0].focus()
    await user.keyboard('{ArrowDown}')
    expect(focusSpy).toHaveBeenCalled()
  })

  it('should call focus on previous item when ArrowUp is pressed', async () => {
    const { user } = await openMenu()

    const menuItems = screen.getAllByRole('menuitemradio')
    const focusSpy = vi.spyOn(menuItems[0], 'focus')

    menuItems[1].focus()
    await user.keyboard('{ArrowUp}')
    expect(focusSpy).toHaveBeenCalled()
  })

  it('should close popover on Escape and restore focus to trigger', async () => {
    const { user } = await openMenu()

    const menuItems = screen.getAllByRole('menuitemradio')
    const trigger = screen.getByRole('button', { name: 'Canvas Mode' })
    const focusSpy = vi.spyOn(trigger, 'focus')

    menuItems[0].focus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(focusSpy).toHaveBeenCalled()
  })
})
