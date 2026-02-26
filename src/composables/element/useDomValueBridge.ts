import type { Ref } from 'vue'
import { customRef, onScopeDispose } from 'vue'

type ValueElement = HTMLInputElement | HTMLTextAreaElement

export function useDomValueBridge(element: ValueElement): Ref<string> {
  const proto = Object.getPrototypeOf(element)
  const nativeDescriptor = Object.getOwnPropertyDescriptor(proto, 'value')
  const existingDescriptor = Object.getOwnPropertyDescriptor(element, 'value')

  const prevGet = existingDescriptor?.get ?? nativeDescriptor?.get
  const prevSet = existingDescriptor?.set ?? nativeDescriptor?.set

  if (!prevGet || !prevSet) {
    return customRef((track, trigger) => ({
      get() {
        track()
        return element.value
      },
      set(v: string) {
        element.value = v
        trigger()
      }
    }))
  }

  let notifyChange: (() => void) | undefined

  const ref = customRef<string>((track, trigger) => {
    notifyChange = trigger
    return {
      get() {
        track()
        return prevGet.call(element)
      },
      set(v: string) {
        prevSet.call(element, v)
        trigger()
      }
    }
  })

  Object.defineProperty(element, 'value', {
    configurable: true,
    enumerable: true,
    get() {
      return prevGet.call(element)
    },
    set(v: string) {
      prevSet.call(element, v)
      notifyChange?.()
    }
  })

  function onInput() {
    notifyChange?.()
  }
  element.addEventListener('input', onInput)

  onScopeDispose(() => {
    element.removeEventListener('input', onInput)
    if (existingDescriptor) {
      Object.defineProperty(element, 'value', existingDescriptor)
    } else {
      delete (element as unknown as Record<string, unknown>).value
    }
  })

  return ref
}
