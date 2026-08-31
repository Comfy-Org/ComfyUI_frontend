import { afterEach, describe, expect, it } from 'vitest'
import { ref } from 'vue'

import { zIndexManager } from '@/utils/zIndexManager'

import { useModalLiftedZIndex } from './useModalLiftedZIndex'

const registered: HTMLElement[] = []

function registerDialog() {
  const el = document.createElement('div')
  zIndexManager.set('modal', el, 1700)
  registered.push(el)
  return Number(el.style.zIndex)
}

afterEach(() => {
  let el = registered.pop()
  while (el) {
    zIndexManager.clear(el)
    el = registered.pop()
  }
})

describe('useModalLiftedZIndex', () => {
  it('lifts past the current top of the modal stack', () => {
    const dialogZIndex = registerDialog()
    const style = useModalLiftedZIndex(ref(true))

    expect(style.value).toEqual({ zIndex: dialogZIndex + 1 })
  })

  it('stays above a dialog stack that has escalated past the static z-3000 fallback', () => {
    // The counter re-adds baseZIndex whenever the previous registration uses a
    // different key, so alternating layers climbs by ~1800 at a time.
    const other = document.createElement('div')
    zIndexManager.set('overlay', other, 1800)
    registered.push(other)
    const dialogZIndex = registerDialog()
    expect(dialogZIndex).toBeGreaterThan(3000)

    const style = useModalLiftedZIndex(ref(true))

    expect(style.value).toEqual({ zIndex: dialogZIndex + 1 })
  })

  it('re-reads the stack on every open rather than caching the first read', () => {
    registerDialog()
    const open = ref(true)
    const style = useModalLiftedZIndex(open)
    expect(style.value).toBeDefined()

    open.value = false
    const laterDialogZIndex = registerDialog()
    open.value = true

    expect(style.value).toEqual({ zIndex: laterDialogZIndex + 1 })
  })
})
