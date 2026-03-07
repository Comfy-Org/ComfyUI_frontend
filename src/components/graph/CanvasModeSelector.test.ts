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

const mockPopoverHide = vi.fn()

function createWrapper() {
  return mount(CanvasModeSelector, {
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
}

describe('CanvasModeSelector', () => {
  it('should render menu with menuitemradio roles and aria-checked', () => {
    const wrapper = createWrapper()

    const menu = wrapper.find('[role="menu"]')
    expect(menu.exists()).toBe(true)

    const menuItems = wrapper.findAll('[role="menuitemradio"]')
    expect(menuItems).toHaveLength(2)

    // Select mode is active (read_only: false), so select is checked
    expect(menuItems[0].attributes('aria-checked')).toBe('true')
    expect(menuItems[1].attributes('aria-checked')).toBe('false')
  })

  it('should render menu items as buttons with aria-labels', () => {
    const wrapper = createWrapper()

    const menuItems = wrapper.findAll('[role="menuitemradio"]')
    menuItems.forEach((btn) => {
      expect(btn.element.tagName).toBe('BUTTON')
      expect(btn.attributes('type')).toBe('button')
    })
    expect(menuItems[0].attributes('aria-label')).toBe('Select')
    expect(menuItems[1].attributes('aria-label')).toBe('Hand')
  })

  it('should use roving tabindex based on active mode', () => {
    const wrapper = createWrapper()

    const menuItems = wrapper.findAll('[role="menuitemradio"]')
    // Select is active (read_only: false) → tabindex 0
    expect(menuItems[0].attributes('tabindex')).toBe('0')
    // Hand is inactive → tabindex -1
    expect(menuItems[1].attributes('tabindex')).toBe('-1')
  })

  it('should mark icons as aria-hidden', () => {
    const wrapper = createWrapper()

    const icons = wrapper.findAll('[role="menuitemradio"] i')
    icons.forEach((icon) => {
      expect(icon.attributes('aria-hidden')).toBe('true')
    })
  })

  it('should expose trigger button with aria-haspopup and aria-expanded', () => {
    const wrapper = createWrapper()

    const trigger = wrapper.find('[aria-haspopup="menu"]')
    expect(trigger.exists()).toBe(true)
    expect(trigger.attributes('aria-label')).toBe('Canvas Mode')
    expect(trigger.attributes('aria-expanded')).toBe('false')
  })

  it('should call focus on next item when ArrowDown is pressed', async () => {
    const wrapper = createWrapper()

    const menuItems = wrapper.findAll('[role="menuitemradio"]')
    const secondItemEl = menuItems[1].element as HTMLElement
    const focusSpy = vi.spyOn(secondItemEl, 'focus')

    await menuItems[0].trigger('keydown', { key: 'ArrowDown' })
    expect(focusSpy).toHaveBeenCalled()
  })

  it('should call focus on previous item when ArrowUp is pressed', async () => {
    const wrapper = createWrapper()

    const menuItems = wrapper.findAll('[role="menuitemradio"]')
    const firstItemEl = menuItems[0].element as HTMLElement
    const focusSpy = vi.spyOn(firstItemEl, 'focus')

    await menuItems[1].trigger('keydown', { key: 'ArrowUp' })
    expect(focusSpy).toHaveBeenCalled()
  })

  it('should close popover on Escape and restore focus to trigger', async () => {
    const wrapper = createWrapper()

    const menuItems = wrapper.findAll('[role="menuitemradio"]')
    const trigger = wrapper.find('[aria-haspopup="menu"]')
    const triggerEl = trigger.element as HTMLElement
    const focusSpy = vi.spyOn(triggerEl, 'focus')

    await menuItems[0].trigger('keydown', { key: 'Escape' })
    expect(mockPopoverHide).toHaveBeenCalled()
    expect(focusSpy).toHaveBeenCalled()
  })
})
