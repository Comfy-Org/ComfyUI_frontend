import { fromAny } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type ElChild = Node | string
type ElInput = Record<string, unknown> | ElChild | ElChild[]

function appendChildren(element: HTMLElement, children: ElChild | ElChild[]) {
  const list = Array.isArray(children) ? children : [children]
  for (const child of list) {
    element.append(child)
  }
}

vi.mock('../../ui', () => ({
  $el: (tag: string, propsOrChildren?: ElInput, children?: ElChild[]) => {
    const [tagName, ...classes] = tag.split('.')
    const element = document.createElement(tagName)
    if (classes.length) element.classList.add(...classes)

    if (
      propsOrChildren instanceof Node ||
      typeof propsOrChildren === 'string' ||
      Array.isArray(propsOrChildren)
    ) {
      appendChildren(element, propsOrChildren)
    } else if (propsOrChildren) {
      for (const [key, value] of Object.entries(propsOrChildren)) {
        if (key === '$' && typeof value === 'function') {
          value(element)
        } else if (key === 'parent' && value instanceof HTMLElement) {
          value.append(element)
        } else if (key === 'textContent') {
          element.textContent = String(value)
        } else if (key === 'ariaLabel') {
          element.setAttribute('aria-label', String(value))
        } else if (key === 'ariaHasPopup') {
          element.setAttribute('aria-haspopup', String(value))
        } else if (key === 'type') {
          element.setAttribute('type', String(value))
        } else if (
          key.toLowerCase().startsWith('on') &&
          typeof value === 'function'
        ) {
          element.addEventListener(
            key.slice(2).toLowerCase(),
            value as EventListener
          )
        }
      }
    }

    if (children) appendChildren(element, children)
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

vi.mock('../utils', () => ({
  applyClasses: (
    element: HTMLElement,
    classList: string | Record<string, boolean>,
    ...baseClasses: string[]
  ) => {
    element.className = baseClasses.join(' ')
    if (typeof classList === 'string') {
      element.classList.add(...classList.split(' ').filter(Boolean))
    } else {
      for (const [className, enabled] of Object.entries(classList)) {
        element.classList.toggle(className, enabled)
      }
    }
  },
  toggleElement:
    <T>(
      element: HTMLElement,
      {
        onShow
      }: {
        onShow?: (element: HTMLElement, value: T) => void
      } = {}
    ) =>
    (value: T) => {
      element.hidden = !value
      if (value) onShow?.(element, value)
    }
}))

import { ComfyAsyncDialog } from './asyncDialog'
import { ComfyButton } from './button'
import { ComfyButtonGroup } from './buttonGroup'
import { ComfyPopup } from './popup'
import { ComfySplitButton } from './splitButton'

function targetWithRect(rect: DOMRect) {
  const target = document.createElement('button')
  vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(rect)
  document.body.append(target)
  return target
}

describe('ComfyPopup and related UI components', () => {
  beforeEach(() => {
    document.body.replaceChildren()
    vi.restoreAllMocks()
  })

  it('opens, positions, updates children and classes, and closes from escape', () => {
    const target = targetWithRect(
      DOMRect.fromRect({ x: 10, y: 20, width: 80, height: 30 })
    )
    const child = document.createElement('span')
    const popup = new ComfyPopup(
      { target, classList: { menu: true, hidden: false } },
      child
    )
    const open = vi.fn()
    const close = vi.fn()
    const change = vi.fn()
    popup.addEventListener('open', open)
    popup.addEventListener('close', close)
    popup.addEventListener('change', change)
    vi.spyOn(popup.element, 'getBoundingClientRect').mockReturnValue(
      DOMRect.fromRect({ height: 20 })
    )

    popup.open = true

    expect(open).toHaveBeenCalledOnce()
    expect(change).toHaveBeenCalledOnce()
    expect(popup.element).toHaveClass('open')
    expect(popup.element.style.getPropertyValue('--left')).toBe('10px')
    expect(popup.element.style.getPropertyValue('--bottom')).toBe('35px')

    const nextChild = document.createElement('strong')
    popup.children = [nextChild]
    popup.classList = 'extra'

    expect(popup.element.firstElementChild).toBe(nextChild)
    expect(popup.element).toHaveClass('comfyui-popup', 'left', 'extra')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    expect(popup.open).toBe(true)

    const escape = new KeyboardEvent('keydown', {
      key: 'Escape',
      cancelable: true
    })
    window.dispatchEvent(escape)

    expect(close).toHaveBeenCalledOnce()
    expect(escape.defaultPrevented).toBe(true)
    expect(popup.open).toBe(false)
  })

  it('handles outside clicks, target clicks, and relative right positioning', () => {
    const target = targetWithRect(
      DOMRect.fromRect({ x: 100, y: 40, width: 60, height: 25 })
    )
    const container = document.createElement('section')
    document.body.append(container)
    const popup = new ComfyPopup({
      target,
      container,
      position: 'relative',
      horizontal: 'right'
    })
    vi.spyOn(popup.element, 'getBoundingClientRect').mockReturnValue(
      DOMRect.fromRect({ height: 100 })
    )
    Object.defineProperty(popup.element, 'clientWidth', {
      configurable: true,
      value: 40
    })

    popup.open = true
    target.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(popup.open).toBe(true)

    const outside = document.createElement('div')
    document.body.append(outside)
    outside.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(popup.open).toBe(false)
    expect(popup.element.style.getPropertyValue('--left')).toBe('0px')
    expect(popup.element.style.getPropertyValue('--top')).toBe('25px')
  })

  it('keeps outside clicks open when target clicks are not ignored', () => {
    const target = targetWithRect(DOMRect.fromRect({ height: 10 }))
    const popup = new ComfyPopup({
      target,
      ignoreTarget: false,
      closeOnEscape: false
    })
    const outside = document.createElement('div')
    document.body.append(outside)

    popup.toggle()
    outside.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    expect(popup.open).toBe(true)
  })

  it('renders split button popup items and updates button groups', () => {
    const primary = new ComfyButton({ content: 'Queue' })
    const itemButton = new ComfyButton({ content: 'Queue front' })
    const rawItem = document.createElement('button')
    rawItem.textContent = 'Queue back'
    const split = new ComfySplitButton(
      {
        primary,
        mode: 'hover',
        horizontal: 'right',
        position: 'absolute'
      },
      itemButton,
      rawItem
    )

    expect(split.element).toHaveClass('comfyui-split-button', 'hover')
    expect(split.popup.element).toHaveTextContent('Queue front')
    expect(split.popup.element).toHaveTextContent('Queue back')
    expect(document.body).toContainElement(split.popup.element)

    const group = new ComfyButtonGroup(primary)
    group.append(itemButton)
    group.insert(fromAny(rawItem), 1)

    expect(group.element.children).toHaveLength(3)
    expect(group.remove(itemButton)).toEqual([itemButton])
    expect(group.remove(itemButton)).toBeUndefined()
    expect(group.element.children).toHaveLength(2)
  })

  it('resolves async dialogs from buttons, close events, and prompt actions', async () => {
    const dialog = new ComfyAsyncDialog<number>([
      { text: 'Seven', value: 7 },
      'Fallback'
    ])

    const promise = dialog.show('Pick one')
    dialog.element.querySelector<HTMLButtonElement>('button')?.click()
    await expect(promise).resolves.toBe(7)

    const closePromise = dialog.show(document.createElement('em'))
    dialog.element.dispatchEvent(new Event('close'))
    await expect(closePromise).resolves.toBeNull()

    const promptPromise = ComfyAsyncDialog.prompt({
      title: 'Confirm',
      message: 'Continue?',
      actions: [{ text: 'Yes', value: 'yes' }]
    })
    const prompt = Array.from(document.querySelectorAll('dialog')).at(-1)
    expect(prompt).toHaveTextContent('Confirm')
    prompt?.querySelector<HTMLButtonElement>('button')?.click()

    await expect(promptPromise).resolves.toBe('yes')
    expect(document.body).not.toContainElement(prompt ?? null)
  })
})
