import { afterEach, describe, expect, it } from 'vitest'

import {
  MODAL_LAYER_SELECTOR,
  raiseModalLayer,
  releaseModalLayer,
  topModalZIndex
} from './modalLayerStack'

const layers: HTMLElement[] = []

function raise(element = document.createElement('div')) {
  layers.push(element)
  raiseModalLayer(element)
  return element
}

afterEach(() => {
  layers.splice(0).forEach(releaseModalLayer)
})

describe('modalLayerStack', () => {
  it('reports no top layer while the stack is empty', () => {
    expect(topModalZIndex()).toBe(0)
  })

  it('stacks each raised layer above the previous one', () => {
    const first = raise()
    const second = raise()

    expect([first.style.zIndex, second.style.zIndex]).toEqual(['1701', '1702'])
    expect(topModalZIndex()).toBe(1702)
  })

  it('moves a re-raised layer to the top without growing the stack', () => {
    const first = raise()
    raise()

    raiseModalLayer(first)

    expect(first.style.zIndex).toBe('1703')
    expect(topModalZIndex()).toBe(1703)
    releaseModalLayer(first)
    expect(topModalZIndex()).toBe(1702)
  })

  it('keeps the top layer when a lower layer is released', () => {
    const lower = raise()
    raise()

    releaseModalLayer(lower)

    expect(topModalZIndex()).toBe(1702)
  })

  it('identifies layers by element even when their z-index styles collide', () => {
    const first = raise()
    const second = raise()
    second.style.zIndex = first.style.zIndex

    releaseModalLayer(first)

    expect(topModalZIndex()).toBe(1702)
  })

  it('marks raised layers so outside-interaction guards can find them', () => {
    const layer = raise()
    const child = document.createElement('button')
    layer.appendChild(child)

    expect(child.closest(MODAL_LAYER_SELECTOR)).toBe(layer)

    releaseModalLayer(layer)

    expect(child.closest(MODAL_LAYER_SELECTOR)).toBeNull()
    expect(layer.style.zIndex).toBe('')
  })
})
