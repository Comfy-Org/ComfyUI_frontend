import { afterEach, describe, expect, it } from 'vitest'
import { createApp, ref } from 'vue'
import type { Ref } from 'vue'

import { raiseModalLayer, releaseModalLayer } from '@/utils/modalLayerStack'

import { overlayZIndexKey, useModalLiftedZIndex } from './useModalLiftedZIndex'

const registered: HTMLElement[] = []

function setupStyle(open: Ref<boolean>, parentZIndex = 0) {
  const app = createApp({})
  app.provide(overlayZIndexKey, parentZIndex)
  return app.runWithContext(() => useModalLiftedZIndex(open))
}

function registerDialog() {
  const el = document.createElement('div')
  raiseModalLayer(el)
  registered.push(el)
  return Number(el.style.zIndex)
}

afterEach(() => {
  let el = registered.pop()
  while (el) {
    releaseModalLayer(el)
    el = registered.pop()
  }
})

describe('useModalLiftedZIndex', () => {
  it('lifts past the current top of the modal stack', () => {
    const dialogZIndex = registerDialog()
    const style = setupStyle(ref(true))

    expect(style.value).toEqual({ zIndex: dialogZIndex + 1 })
  })

  it('lifts past the newest of several stacked dialogs', () => {
    registerDialog()
    const topDialogZIndex = registerDialog()

    const style = setupStyle(ref(true))

    expect(style.value).toEqual({ zIndex: topDialogZIndex + 1 })
  })

  it('re-reads the stack on every open rather than caching the first read', () => {
    registerDialog()
    const open = ref(true)
    const style = setupStyle(open)
    expect(style.value).toBeDefined()

    open.value = false
    const laterDialogZIndex = registerDialog()
    open.value = true

    expect(style.value).toEqual({ zIndex: laterDialogZIndex + 1 })
  })

  it('lifts past its owning toast even with a lower dialog open', () => {
    registerDialog()
    const style = setupStyle(ref(true), 9999)

    expect(style.value).toEqual({ zIndex: 10000 })
  })
})
