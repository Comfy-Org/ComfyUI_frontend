import { afterEach, describe, expect, it } from 'vitest'
import type { EffectScope } from 'vue'
import { effectScope, ref, shallowRef } from 'vue'

import { usePaletteSwatchRow } from './usePaletteSwatchRow'

const scopes: EffectScope[] = []

afterEach(() => {
  while (scopes.length) scopes.pop()?.stop()
})

function setup(initial: string[]) {
  const modelValue = ref(initial)
  const container = shallowRef(document.createElement('div'))
  const scope = effectScope()
  scopes.push(scope)
  const api = scope.run(() => usePaletteSwatchRow({ modelValue, container }))!
  return { modelValue, container, ...api }
}

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

  it('updates the color at an index', () => {
    const { modelValue, updateAt } = setup(['#a', '#b'])
    updateAt(1, '#123456')
    expect(modelValue.value).toEqual(['#a', '#123456'])
  })

  it('ignores an update that does not change the color', () => {
    const { modelValue, updateAt } = setup(['#a'])
    const before = modelValue.value
    updateAt(0, '#a')
    expect(modelValue.value).toBe(before)
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
