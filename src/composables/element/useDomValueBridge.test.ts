import { effectScope, watch } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useDomValueBridge } from './useDomValueBridge'

describe('useDomValueBridge', () => {
  let element: HTMLTextAreaElement

  beforeEach(() => {
    element = document.createElement('textarea')
    element.value = 'initial'
  })

  it('reads initial element value', () => {
    const scope = effectScope()
    scope.run(() => {
      const ref = useDomValueBridge(element)
      expect(ref.value).toBe('initial')
    })
    scope.stop()
  })

  it('detects programmatic element.value writes', () => {
    const scope = effectScope()
    scope.run(() => {
      const ref = useDomValueBridge(element)
      const spy = vi.fn()
      watch(ref, spy, { flush: 'sync' })

      element.value = 'programmatic'

      expect(ref.value).toBe('programmatic')
      expect(spy).toHaveBeenCalledWith(
        'programmatic',
        'initial',
        expect.anything()
      )
    })
    scope.stop()
  })

  it('detects user input events', () => {
    const scope = effectScope()
    scope.run(() => {
      const ref = useDomValueBridge(element)
      const spy = vi.fn()
      watch(ref, spy, { flush: 'sync' })

      const nativeDesc = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        'value'
      )!
      nativeDesc.set!.call(element, 'typed')
      element.dispatchEvent(new Event('input'))

      expect(ref.value).toBe('typed')
      expect(spy).toHaveBeenCalled()
    })
    scope.stop()
  })

  it('setting ref updates element value', () => {
    const scope = effectScope()
    scope.run(() => {
      const ref = useDomValueBridge(element)
      ref.value = 'from-ref'
      expect(element.value).toBe('from-ref')
    })
    scope.stop()
  })

  it('chains through existing Object.defineProperty on element', () => {
    const existingSetter = vi.fn()

    const nativeDesc = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      'value'
    )!
    Object.defineProperty(element, 'value', {
      configurable: true,
      get() {
        return nativeDesc.get!.call(element)
      },
      set(v: string) {
        existingSetter(v)
        nativeDesc.set!.call(element, v)
      }
    })

    const scope = effectScope()
    scope.run(() => {
      const ref = useDomValueBridge(element)

      element.value = 'new'
      expect(existingSetter).toHaveBeenCalledWith('new')
      expect(ref.value).toBe('new')
    })
    scope.stop()
  })

  it('restores previous descriptor on scope dispose', () => {
    const scope = effectScope()
    scope.run(() => {
      useDomValueBridge(element)
    })

    const duringDesc = Object.getOwnPropertyDescriptor(element, 'value')
    expect(duringDesc).toBeDefined()

    scope.stop()

    const afterDesc = Object.getOwnPropertyDescriptor(element, 'value')
    expect(afterDesc).toBeUndefined()
  })

  it('restores existing override descriptor on scope dispose', () => {
    const nativeDesc = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      'value'
    )!
    const customGetter = vi.fn(() => nativeDesc.get!.call(element))

    Object.defineProperty(element, 'value', {
      configurable: true,
      get: customGetter,
      set(v: string) {
        nativeDesc.set!.call(element, v)
      }
    })

    const scope = effectScope()
    scope.run(() => {
      useDomValueBridge(element)
    })
    scope.stop()

    element.value
    expect(customGetter).toHaveBeenCalled()
  })

  it('works with HTMLInputElement', () => {
    const input = document.createElement('input')
    input.value = 'input-initial'

    const scope = effectScope()
    scope.run(() => {
      const ref = useDomValueBridge(input)
      expect(ref.value).toBe('input-initial')

      input.value = 'input-updated'
      expect(ref.value).toBe('input-updated')
    })
    scope.stop()
  })
})
