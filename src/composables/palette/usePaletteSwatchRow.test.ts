import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EffectScope } from 'vue'
import { effectScope, ref, shallowRef } from 'vue'

import { usePaletteSwatchRow } from './usePaletteSwatchRow'

const scopes: EffectScope[] = []

afterEach(() => {
  while (scopes.length) scopes.pop()?.stop()
})

function setup(initial: string[]) {
  const modelValue = ref(initial)
  const container = shallowRef<HTMLDivElement | null>(
    document.createElement('div')
  )
  const picker = shallowRef<HTMLInputElement | null>(
    document.createElement('input')
  )
  const scope = effectScope()
  scopes.push(scope)
  const api = scope.run(() =>
    usePaletteSwatchRow({ modelValue, container, picker })
  )!
  return { modelValue, container, picker, ...api }
}

const mouseEvent = () => ({ stopPropagation: vi.fn() }) as unknown as MouseEvent

describe('usePaletteSwatchRow', () => {
  it('appends a default color', () => {
    const { modelValue, addColor } = setup(['#000000'])
    addColor()
    expect(modelValue.value).toEqual(['#000000', '#ffffff'])
  })

  it('removes a color by index', () => {
    const { modelValue, remove } = setup(['#a', '#b', '#c'])
    remove(1)
    expect(modelValue.value).toEqual(['#a', '#c'])
  })

  it('seeds the picker input with the clicked color before opening it', () => {
    const { picker, openPicker } = setup(['#112233'])
    const click = vi.spyOn(picker.value!, 'click')
    openPicker(0, mouseEvent())
    expect(picker.value!.value).toBe('#112233')
    expect(click).toHaveBeenCalled()
  })

  it('falls back to white when the slot is empty', () => {
    const { picker, openPicker } = setup([''])
    openPicker(0, mouseEvent())
    expect(picker.value!.value).toBe('#ffffff')
  })

  it('tracks the picker index even when the input is unavailable', () => {
    const { modelValue, picker, openPicker, onPickerInput } = setup([
      '#000000',
      '#111111'
    ])
    picker.value = null

    openPicker(1, mouseEvent())
    onPickerInput({ target: { value: '#222222' } } as unknown as Event)

    expect(modelValue.value).toEqual(['#000000', '#222222'])
  })

  it('writes the picked color back to the open slot', () => {
    const { modelValue, openPicker, onPickerInput } = setup(['#a', '#b'])
    openPicker(1, mouseEvent())
    onPickerInput({ target: { value: '#123456' } } as unknown as Event)
    expect(modelValue.value).toEqual(['#a', '#123456'])
  })

  it('ignores picker input when no slot is open', () => {
    const { modelValue, onPickerInput } = setup(['#a'])
    onPickerInput({ target: { value: '#123456' } } as unknown as Event)
    expect(modelValue.value).toEqual(['#a'])
  })

  it('reorders via drag when the pointer crosses another swatch', () => {
    const { modelValue, container, onPointerDown } = setup(['#a', '#b'])
    for (const i of [0, 1]) {
      const swatch = document.createElement('div')
      swatch.setAttribute('data-index', String(i))
      container.value!.appendChild(swatch)
    }
    const second = container.value!.children[1] as HTMLDivElement
    second.getBoundingClientRect = () =>
      ({ left: 100, right: 140, top: 0, bottom: 20, width: 40 }) as DOMRect

    onPointerDown(0, { button: 0, clientX: 10, clientY: 10 } as PointerEvent)
    document.dispatchEvent(
      new MouseEvent('pointermove', { clientX: 130, clientY: 10, buttons: 1 })
    )
    expect(modelValue.value).toEqual(['#b', '#a'])
  })

  it('cancels a stale drag when the primary button is no longer pressed', () => {
    const { modelValue, container, onPointerDown } = setup(['#a', '#b'])
    for (const i of [0, 1]) {
      const swatch = document.createElement('div')
      swatch.setAttribute('data-index', String(i))
      container.value!.appendChild(swatch)
    }
    const second = container.value!.children[1] as HTMLDivElement
    second.getBoundingClientRect = () =>
      ({ left: 100, right: 140, top: 0, bottom: 20, width: 40 }) as DOMRect

    onPointerDown(0, { button: 0, clientX: 10, clientY: 10 } as PointerEvent)
    document.dispatchEvent(
      new MouseEvent('pointermove', { clientX: 130, clientY: 10, buttons: 0 })
    )
    expect(modelValue.value).toEqual(['#a', '#b'])
  })

  it('ignores pointer movement before a drag starts', () => {
    const { modelValue } = setup(['#a', '#b'])

    document.dispatchEvent(
      new MouseEvent('pointermove', { clientX: 130, clientY: 10, buttons: 1 })
    )

    expect(modelValue.value).toEqual(['#a', '#b'])
  })

  it('waits until movement passes the drag threshold', () => {
    const { modelValue, container, onPointerDown } = setup(['#a', '#b'])
    const swatch = document.createElement('div')
    swatch.setAttribute('data-index', '1')
    container.value!.appendChild(swatch)

    onPointerDown(0, { button: 0, clientX: 10, clientY: 10 } as PointerEvent)
    document.dispatchEvent(
      new MouseEvent('pointermove', { clientX: 12, clientY: 11, buttons: 1 })
    )

    expect(modelValue.value).toEqual(['#a', '#b'])
  })

  it('ignores active drags when the row container is gone', () => {
    const { modelValue, container, onPointerDown } = setup(['#a', '#b'])
    container.value = null

    onPointerDown(0, { button: 0, clientX: 10, clientY: 10 } as PointerEvent)
    document.dispatchEvent(
      new MouseEvent('pointermove', { clientX: 130, clientY: 10, buttons: 1 })
    )

    expect(modelValue.value).toEqual(['#a', '#b'])
  })

  it('ignores invalid target rows during drag', () => {
    const { modelValue, container, onPointerDown } = setup(['#a', '#b'])
    const current = document.createElement('div')
    current.setAttribute('data-index', '0')
    const invalid = document.createElement('div')
    invalid.setAttribute('data-index', '-1')
    container.value!.append(current, invalid)
    invalid.getBoundingClientRect = () =>
      ({ left: 100, right: 140, top: 0, bottom: 20, width: 40 }) as DOMRect

    onPointerDown(0, { button: 0, clientX: 10, clientY: 10 } as PointerEvent)
    document.dispatchEvent(
      new MouseEvent('pointermove', { clientX: 130, clientY: 10, buttons: 1 })
    )

    expect(modelValue.value).toEqual(['#a', '#b'])
  })

  it('cancels drags on pointerup and pointercancel', () => {
    const { modelValue, container, onPointerDown } = setup(['#a', '#b'])
    const swatch = document.createElement('div')
    swatch.setAttribute('data-index', '1')
    container.value!.appendChild(swatch)
    swatch.getBoundingClientRect = () =>
      ({ left: 100, right: 140, top: 0, bottom: 20, width: 40 }) as DOMRect

    onPointerDown(0, { button: 0, clientX: 10, clientY: 10 } as PointerEvent)
    document.dispatchEvent(new PointerEvent('pointerup'))
    document.dispatchEvent(
      new MouseEvent('pointermove', { clientX: 130, clientY: 10, buttons: 1 })
    )
    onPointerDown(0, { button: 0, clientX: 10, clientY: 10 } as PointerEvent)
    document.dispatchEvent(new PointerEvent('pointercancel'))
    document.dispatchEvent(
      new MouseEvent('pointermove', { clientX: 130, clientY: 10, buttons: 1 })
    )

    expect(modelValue.value).toEqual(['#a', '#b'])
  })

  it('ignores non-left-button pointer downs', () => {
    const { modelValue, container, onPointerDown } = setup(['#a', '#b'])
    const swatch = document.createElement('div')
    swatch.setAttribute('data-index', '1')
    container.value!.appendChild(swatch)
    onPointerDown(0, { button: 2, clientX: 10, clientY: 10 } as PointerEvent)
    document.dispatchEvent(
      new MouseEvent('pointermove', { clientX: 130, clientY: 10 })
    )
    expect(modelValue.value).toEqual(['#a', '#b'])
  })
})
