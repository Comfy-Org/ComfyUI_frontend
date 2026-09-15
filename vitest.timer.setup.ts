import { afterEach, beforeEach, vi } from 'vitest'

function nodeNameFor(node: Node, fallback: (this: Node) => unknown) {
  let prototype = Object.getPrototypeOf(node)
  while (prototype !== Node.prototype) {
    const getter = Object.getOwnPropertyDescriptor(prototype, 'nodeName')?.get
    if (getter) return getter.call(node)
    prototype = Object.getPrototypeOf(prototype)
  }
  return fallback.call(node)
}

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
        return nodeNameFor(this, originalNodeName)
      }
    })
  }
}

fixHappyDomNodeName()

function resetDocument() {
  if (typeof document !== 'undefined') document.body.replaceChildren()
}

function resetHistory() {
  if (typeof window !== 'undefined') window.history.replaceState({}, '', '/')
}

function clearLocalStorage() {
  if (typeof localStorage !== 'undefined') localStorage.clear()
}

function clearSessionStorage() {
  if (typeof sessionStorage !== 'undefined') sessionStorage.clear()
}

beforeEach(() => {
  resetDocument()
  resetHistory()
  clearLocalStorage()
  clearSessionStorage()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})
