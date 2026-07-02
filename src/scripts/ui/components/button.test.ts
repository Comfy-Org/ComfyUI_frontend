import { fromAny } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ComfyApp } from '@/scripts/app'

vi.mock('../../ui', () => ({
  $el: (tag: string, props?: Record<string, unknown>, children?: Node[]) => {
    const [tagName, ...classes] = tag.split('.')
    const element = document.createElement(tagName)
    if (classes.length) element.classList.add(...classes)
    if (props) {
      const listeners = Object.entries(props).filter(([key]) =>
        key.startsWith('on')
      )
      for (const [key, listener] of listeners) {
        if (typeof listener === 'function') {
          element.addEventListener(key.slice(2), listener as EventListener)
        }
      }
    }
    if (children) element.append(...children)
    return element
  }
}))

vi.mock('../../utils', () => ({
  prop: <T>(
    target: object,
    name: string,
    defaultValue: T,
    onChanged?: (currentValue: T, previousValue: T) => void
  ) => {
    let currentValue: T
    Object.defineProperty(target, name, {
      get() {
        return currentValue
      },
      set(newValue: T) {
        const previousValue = currentValue
        currentValue = newValue
        onChanged?.(currentValue, previousValue)
      }
    })
    ;(target as Record<string, T>)[name] = defaultValue
    return defaultValue
  }
}))

import { ComfyButton } from './button'

class MockPopup extends EventTarget {
  element = document.createElement('div')
  open = false
  toggle = vi.fn(() => {
    this.open = !this.open
    this.dispatchEvent(new CustomEvent('change'))
  })
}

function mockApp(settingValue: boolean) {
  let listener: (() => void) | undefined
  const app = {
    ui: {
      settings: {
        getSettingValue: vi.fn(() => settingValue),
        addEventListener: vi.fn((_event: string, callback: () => void) => {
          listener = callback
        })
      }
    }
  } as unknown as ComfyApp
  return {
    app,
    setSettingValue(value: boolean) {
      settingValue = value
      listener?.()
    }
  }
}

describe('ComfyButton', () => {
  beforeEach(() => {
    document.body.replaceChildren()
  })

  it('renders icon, content, tooltip, enabled state, and click action', () => {
    const action = vi.fn()
    const button = new ComfyButton({
      icon: 'play',
      overIcon: 'pause',
      iconSize: 18,
      content: 'Run',
      tooltip: 'Queue prompt',
      enabled: false,
      classList: { primary: true, hiddenClass: false },
      action
    })

    expect(button.iconElement.className).toBe('mdi mdi-play mdi-18px')
    expect(button.contentElement.textContent).toBe('Run')
    expect(button.element.title).toBe('Queue prompt')
    expect(button.element.getAttribute('aria-label')).toBe('Queue prompt')
    expect(button.element.classList.contains('primary')).toBe(true)
    expect(button.element.classList.contains('disabled')).toBe(true)
    expect((button.element as HTMLButtonElement).disabled).toBe(true)

    button.enabled = true
    button.element.dispatchEvent(new MouseEvent('mouseenter'))
    expect(button.iconElement.className).toBe('mdi mdi-pause mdi-18px')
    button.element.dispatchEvent(new MouseEvent('mouseleave'))
    expect(button.iconElement.className).toBe('mdi mdi-play mdi-18px')

    button.element.dispatchEvent(new MouseEvent('click'))
    expect(action).toHaveBeenCalledWith(expect.any(MouseEvent), button)
  })

  it('supports HTMLElement content and removing tooltip text', () => {
    const button = new ComfyButton({ content: 'Text', tooltip: 'Hint' })
    const content = document.createElement('strong')
    content.textContent = 'Element'

    button.content = content
    button.tooltip = ''

    expect(button.contentElement.firstElementChild).toBe(content)
    expect(button.element.hasAttribute('title')).toBe(false)
  })

  it('updates the hover icon when overIcon changes while hovered', () => {
    const button = new ComfyButton({ icon: 'play' })

    button.element.dispatchEvent(new MouseEvent('mouseenter'))
    button.overIcon = 'pause'

    expect(button.iconElement.className).toBe('mdi mdi-pause')
  })

  it('hides and shows from a visibility setting', () => {
    const settings = mockApp(false)
    const button = new ComfyButton({
      app: settings.app,
      visibilitySetting: {
        id: 'Comfy.UseNewMenu',
        showValue: true
      }
    })

    expect(button.hidden).toBe(true)
    expect(button.element.classList.contains('hidden')).toBe(true)

    settings.setSettingValue(true)

    expect(button.hidden).toBe(false)
    expect(button.element.classList.contains('hidden')).toBe(false)
  })

  it('toggles click popups and reflects popup open state in classes', () => {
    const popup = new MockPopup()
    const button = new ComfyButton({ icon: 'dots' }).withPopup(fromAny(popup))

    button.element.dispatchEvent(new MouseEvent('click'))

    expect(popup.toggle).toHaveBeenCalledOnce()
    expect(button.element.classList.contains('popup-open')).toBe(true)

    popup.toggle()

    expect(button.element.classList.contains('popup-closed')).toBe(true)
  })

  it('opens hover popups while either the button or popup is hovered', () => {
    const popup = new MockPopup()
    const button = new ComfyButton({ icon: 'dots' }).withPopup(
      fromAny(popup),
      'hover'
    )

    button.element.dispatchEvent(new MouseEvent('mouseenter'))
    expect(popup.open).toBe(true)
    popup.element.dispatchEvent(new MouseEvent('mouseenter'))
    button.element.dispatchEvent(new MouseEvent('mouseleave'))
    expect(popup.open).toBe(true)
    popup.element.dispatchEvent(new MouseEvent('mouseleave'))
    expect(popup.open).toBe(false)
  })

  it('does not click-toggle a hover popup while hovered', () => {
    const popup = new MockPopup()
    const button = new ComfyButton({ icon: 'dots' }).withPopup(
      fromAny(popup),
      'hover'
    )

    button.element.dispatchEvent(new MouseEvent('mouseenter'))
    button.element.dispatchEvent(new MouseEvent('click'))

    expect(popup.toggle).not.toHaveBeenCalled()
  })
})
