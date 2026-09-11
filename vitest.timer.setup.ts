import { afterEach, beforeEach, vi } from 'vitest'

function fixHappyDomNodeName() {
  if (typeof Node === 'undefined') return

  const descriptor = Object.getOwnPropertyDescriptor(Node.prototype, 'nodeName')
  const originalNodeName = descriptor?.get

  // DOMPurify reads nodeName through Node.prototype, whose happy-dom getter does
  // not dispatch to the concrete node type: https://github.com/capricorn86/happy-dom/issues/2182
  if (originalNodeName?.call(document.createElement('div')) === '') {
    Object.defineProperty(Node.prototype, 'nodeName', {
      ...descriptor,
      get(this: Node) {
        let prototype: object | null = Object.getPrototypeOf(this)
        while (prototype && prototype !== Node.prototype) {
          const getter = Object.getOwnPropertyDescriptor(
            prototype,
            'nodeName'
          )?.get
          if (getter) return getter.call(this)
          prototype = Object.getPrototypeOf(prototype)
        }
        return originalNodeName.call(this)
      }
    })
  }
}

fixHappyDomNodeName()

beforeEach(() => {
  if (typeof document !== 'undefined') document.body.replaceChildren()
  if (typeof window !== 'undefined') window.history.replaceState({}, '', '/')
  if (typeof localStorage !== 'undefined') localStorage.clear()
  if (typeof sessionStorage !== 'undefined') sessionStorage.clear()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})
