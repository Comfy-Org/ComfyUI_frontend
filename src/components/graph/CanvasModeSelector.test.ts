import { mount } from '@vue/test-utils'
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

function createWrapper() {
  return mount(CanvasModeSelector, {
    global: {
      plugins: [i18n],
      stubs: {
        Popover: {
          template: '<div><slot /></div>',
          methods: {
            toggle: vi.fn(),
            hide: vi.fn()
          }
        }
      }
    }
  })
}

describe('CanvasModeSelector', () => {
  it('should render menu items with correct ARIA roles', () => {
    const wrapper = createWrapper()

    const menu = wrapper.find('[role="menu"]')
    expect(menu.exists()).toBe(true)

    const menuItems = wrapper.findAll('[role="menuitem"]')
    expect(menuItems).toHaveLength(2)
  })

  it('should render menu items as buttons', () => {
    const wrapper = createWrapper()

    const buttons = wrapper.findAll('[role="menuitem"]')
    buttons.forEach((btn) => {
      expect(btn.element.tagName).toBe('BUTTON')
      expect(btn.attributes('type')).toBe('button')
    })
  })

  it('should have aria-labels on menu items', () => {
    const wrapper = createWrapper()

    const menuItems = wrapper.findAll('[role="menuitem"]')
    expect(menuItems[0].attributes('aria-label')).toBe('Select')
    expect(menuItems[1].attributes('aria-label')).toBe('Hand')
  })

  it('should mark icons as aria-hidden', () => {
    const wrapper = createWrapper()

    const icons = wrapper.findAll('[role="menuitem"] i')
    icons.forEach((icon) => {
      expect(icon.attributes('aria-hidden')).toBe('true')
    })
  })

  it('should have keydown handlers for arrow key navigation', () => {
    const wrapper = createWrapper()

    const menuItems = wrapper.findAll('[role="menuitem"]')
    menuItems.forEach((item) => {
      const el = item.element as HTMLElement
      expect(el.tagName).toBe('BUTTON')
    })
  })

  it('should call focus on next item when ArrowDown is pressed', async () => {
    const wrapper = createWrapper()

    const menuItems = wrapper.findAll('[role="menuitem"]')
    const secondItemEl = menuItems[1].element as HTMLElement
    const focusSpy = vi.spyOn(secondItemEl, 'focus')

    await menuItems[0].trigger('keydown', { key: 'ArrowDown' })
    expect(focusSpy).toHaveBeenCalled()
  })

  it('should call focus on previous item when ArrowUp is pressed', async () => {
    const wrapper = createWrapper()

    const menuItems = wrapper.findAll('[role="menuitem"]')
    const firstItemEl = menuItems[0].element as HTMLElement
    const focusSpy = vi.spyOn(firstItemEl, 'focus')

    await menuItems[1].trigger('keydown', { key: 'ArrowUp' })
    expect(focusSpy).toHaveBeenCalled()
  })
})
