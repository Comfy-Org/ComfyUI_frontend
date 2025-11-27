/**
 * Setup browser globals for i18n collection in Node.js environment
 *
 * This file is imported at the top of i18n collection test files to provide
 * browser globals that are referenced in the codebase but not available in Node.js
 */

import { JSDOM } from 'jsdom'

// Create a minimal JSDOM instance
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost:5173',
  pretendToBeVisual: true,
  resources: 'usable'
})

// Set up global window and document
global.window = dom.window
global.document = dom.window.document

// Use defineProperty for read-only globals
Object.defineProperty(global, 'navigator', {
  value: dom.window.navigator,
  writable: true,
  configurable: true
})

// Set up other common browser globals
global.HTMLElement = dom.window.HTMLElement
global.Element = dom.window.Element
global.Node = dom.window.Node
global.NodeList = dom.window.NodeList
global.MutationObserver = dom.window.MutationObserver
global.ResizeObserver = dom.window.ResizeObserver || class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.IntersectionObserver = dom.window.IntersectionObserver || class IntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Set up basic localStorage and sessionStorage
global.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {}
}
global.sessionStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {}
}

// Mock requestAnimationFrame
global.requestAnimationFrame = (callback) => setTimeout(callback, 0)
global.cancelAnimationFrame = (id) => clearTimeout(id)
