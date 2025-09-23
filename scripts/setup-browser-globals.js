// Setup browser-like globals for Node.js environment
import { Window } from 'happy-dom'

// Set build-time constants
global.__USE_PROD_CONFIG__ = false
global.__USE_LOCAL_SERVER__ = true
global.__RUN_TESTS__ = true

const window = new Window({
  url: 'http://localhost:5173',
  width: 1024,
  height: 768
})

global.window = window
global.document = window.document
global.location = window.location
// Don't set navigator if it's read-only
if (!global.navigator || Object.getOwnPropertyDescriptor(global, 'navigator')?.set) {
  global.navigator = window.navigator
}
global.HTMLElement = window.HTMLElement
global.Element = window.Element
global.CustomEvent = window.CustomEvent
global.requestAnimationFrame = window.requestAnimationFrame

// Use happy-dom's storage implementations
global.localStorage = window.localStorage
global.sessionStorage = window.sessionStorage

// Mock fetch if not available
if (!global.fetch) {
  global.fetch = () => Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    blob: () => Promise.resolve(new Blob()),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    headers: new Map()
  })
}

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Mock getComputedStyle
global.getComputedStyle = window.getComputedStyle

// Mock createRange
global.document.createRange = () => ({
  setStart: () => {},
  setEnd: () => {},
  getBoundingClientRect: () => ({
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 0,
    height: 0
  }),
  getClientRects: () => []
})