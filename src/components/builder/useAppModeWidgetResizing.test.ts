import { describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'

import type { InputWidgetConfig } from '@/platform/workflow/management/stores/comfyWorkflow'
import type { WidgetEntityId } from '@/world/entityIds'

import { useAppModeWidgetResizing } from './useAppModeWidgetResizing'

const ENTITY_PROMPT = 'g:1:prompt' as WidgetEntityId
const ENTITY_OTHER = 'g:2:other' as WidgetEntityId
const ENTITY_IMAGE = 'g:1:image' as WidgetEntityId

function setHeight(el: HTMLElement, height: number) {
  Object.defineProperty(el, 'offsetHeight', {
    value: height,
    configurable: true
  })
}

function wrapWithTextarea(initialHeight = 100): {
  wrapper: HTMLDivElement
  textarea: HTMLTextAreaElement
} {
  const wrapper = document.createElement('div')
  const textarea = document.createElement('textarea')
  wrapper.appendChild(textarea)
  document.body.appendChild(wrapper)
  setHeight(textarea, initialHeight)
  return { wrapper, textarea }
}

describe('useAppModeWidgetResizing', () => {
  function setup() {
    const onResize =
      vi.fn<(entityId: WidgetEntityId, config: InputWidgetConfig) => void>()
    const { onPointerDown } = useAppModeWidgetResizing(onResize)

    function bind(wrapper: HTMLElement, entityId: WidgetEntityId) {
      wrapper.addEventListener(
        'pointerdown',
        (e) => onPointerDown(entityId, e as PointerEvent),
        { capture: true }
      )
    }

    return { onResize, bind }
  }

  it('persists height when textarea is resized via drag', () => {
    const { bind, onResize } = setup()
    const { wrapper, textarea } = wrapWithTextarea()
    bind(wrapper, ENTITY_PROMPT)

    textarea.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    setHeight(textarea, 250)
    window.dispatchEvent(new PointerEvent('pointerup'))

    expect(onResize).toHaveBeenCalledWith(ENTITY_PROMPT, { height: 250 })
  })

  it('does not persist when no height change occurs (e.g. a click)', () => {
    const { bind, onResize } = setup()
    const { wrapper, textarea } = wrapWithTextarea()
    bind(wrapper, ENTITY_PROMPT)

    textarea.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    window.dispatchEvent(new PointerEvent('pointerup'))

    expect(onResize).not.toHaveBeenCalled()
  })

  it('persists once per drag gesture; stray pointerup is a no-op', () => {
    const { bind, onResize } = setup()
    const { wrapper, textarea } = wrapWithTextarea()
    bind(wrapper, ENTITY_PROMPT)

    textarea.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    setHeight(textarea, 250)
    window.dispatchEvent(new PointerEvent('pointerup'))
    window.dispatchEvent(new PointerEvent('pointerup'))

    expect(onResize).toHaveBeenCalledTimes(1)
  })

  it('ignores pointerdown on non-resizable targets (label, button, popover)', () => {
    const { bind, onResize } = setup()
    const wrapper = document.createElement('div')
    const button = document.createElement('button')
    wrapper.appendChild(button)
    document.body.appendChild(wrapper)
    bind(wrapper, ENTITY_PROMPT)

    button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    window.dispatchEvent(new PointerEvent('pointerup'))

    expect(onResize).not.toHaveBeenCalled()
  })

  it('persists when target is a descendant of the drop-zone-indicator', () => {
    const { bind, onResize } = setup()
    const wrapper = document.createElement('div')
    const indicator = document.createElement('div')
    indicator.setAttribute('data-slot', 'drop-zone-indicator')
    const inner = document.createElement('span')
    indicator.appendChild(inner)
    wrapper.appendChild(indicator)
    document.body.appendChild(wrapper)
    setHeight(indicator, 100)
    bind(wrapper, ENTITY_IMAGE)

    inner.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    setHeight(indicator, 250)
    window.dispatchEvent(new PointerEvent('pointerup'))

    expect(onResize).toHaveBeenCalledWith(ENTITY_IMAGE, { height: 250 })
  })

  it('drops a stale gesture when a new pointerdown starts before pointerup arrives', () => {
    const { bind, onResize } = setup()
    const first = wrapWithTextarea()
    const second = wrapWithTextarea()
    bind(first.wrapper, ENTITY_PROMPT)
    bind(second.wrapper, ENTITY_OTHER)

    first.textarea.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true })
    )
    setHeight(first.textarea, 250)

    second.textarea.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true })
    )
    setHeight(second.textarea, 300)
    window.dispatchEvent(new PointerEvent('pointerup'))

    expect(onResize).toHaveBeenCalledTimes(1)
    expect(onResize).toHaveBeenCalledWith(ENTITY_OTHER, { height: 300 })
  })

  it('treats pointercancel as the end of a gesture and persists the new height', () => {
    const { bind, onResize } = setup()
    const { wrapper, textarea } = wrapWithTextarea()
    bind(wrapper, ENTITY_PROMPT)

    textarea.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    setHeight(textarea, 250)
    window.dispatchEvent(new PointerEvent('pointercancel'))

    expect(onResize).toHaveBeenCalledWith(ENTITY_PROMPT, { height: 250 })
  })

  it('after pointercancel, a subsequent stray pointerup is a no-op', () => {
    const { bind, onResize } = setup()
    const { wrapper, textarea } = wrapWithTextarea()
    bind(wrapper, ENTITY_PROMPT)

    textarea.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    setHeight(textarea, 250)
    window.dispatchEvent(new PointerEvent('pointercancel'))
    setHeight(textarea, 400)
    window.dispatchEvent(new PointerEvent('pointerup'))

    expect(onResize).toHaveBeenCalledTimes(1)
    expect(onResize).toHaveBeenCalledWith(ENTITY_PROMPT, { height: 250 })
  })

  it('removes global listeners when the owning scope is disposed mid-gesture', () => {
    const onResize =
      vi.fn<(entityId: WidgetEntityId, config: InputWidgetConfig) => void>()
    const scope = effectScope()
    const { onPointerDown } = scope.run(() =>
      useAppModeWidgetResizing(onResize)
    )!
    const { wrapper, textarea } = wrapWithTextarea()
    wrapper.addEventListener(
      'pointerdown',
      (e) => onPointerDown(ENTITY_PROMPT, e as PointerEvent),
      { capture: true }
    )

    textarea.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    setHeight(textarea, 250)
    scope.stop()
    window.dispatchEvent(new PointerEvent('pointerup'))
    window.dispatchEvent(new PointerEvent('pointercancel'))

    expect(onResize).not.toHaveBeenCalled()
  })

  it('does not match a resizable that is an ancestor of the wrapper', () => {
    const { bind, onResize } = setup()
    // An unrelated drop-zone-indicator outside the wrapper would otherwise be
    // returned by target.closest(...) walking up the tree.
    const outerIndicator = document.createElement('div')
    outerIndicator.setAttribute('data-slot', 'drop-zone-indicator')
    const wrapper = document.createElement('div')
    const inner = document.createElement('span')
    wrapper.appendChild(inner)
    outerIndicator.appendChild(wrapper)
    document.body.appendChild(outerIndicator)
    setHeight(outerIndicator, 100)
    bind(wrapper, ENTITY_PROMPT)

    inner.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    setHeight(outerIndicator, 250)
    window.dispatchEvent(new PointerEvent('pointerup'))

    expect(onResize).not.toHaveBeenCalled()
  })
})
