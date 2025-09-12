// Polyfill browser globals for Node.js context during test imports
import { Window } from 'happy-dom';

// Define build-time constants
if (typeof globalThis.__USE_PROD_CONFIG__ === 'undefined') {
  globalThis.__USE_PROD_CONFIG__ = false;
}

// Create a happy-dom window instance
const window = new Window({
  url: 'http://localhost:5173/',
  width: 1024,
  height: 768
});

// Expose DOM globals (only set if not already defined)
if (!globalThis.window) globalThis.window = window;
if (!globalThis.document) globalThis.document = window.document;
if (!globalThis.location) globalThis.location = window.location;
if (!globalThis.navigator) {
  try {
    globalThis.navigator = window.navigator;
  } catch (e) {
    // navigator might be read-only in some environments
  }
}
if (!globalThis.HTMLElement) globalThis.HTMLElement = window.HTMLElement;
if (!globalThis.Element) globalThis.Element = window.Element;
if (!globalThis.Node) globalThis.Node = window.Node;
if (!globalThis.NodeList) globalThis.NodeList = window.NodeList;
if (!globalThis.DOMParser) globalThis.DOMParser = window.DOMParser;
if (!globalThis.XMLSerializer) globalThis.XMLSerializer = window.XMLSerializer;
if (!globalThis.localStorage) globalThis.localStorage = window.localStorage;
if (!globalThis.sessionStorage) globalThis.sessionStorage = window.sessionStorage;
if (!globalThis.CustomEvent) globalThis.CustomEvent = window.CustomEvent;
if (!globalThis.Event) globalThis.Event = window.Event;
if (!globalThis.MouseEvent) globalThis.MouseEvent = window.MouseEvent;
if (!globalThis.KeyboardEvent) globalThis.KeyboardEvent = window.KeyboardEvent;
if (!globalThis.getComputedStyle) globalThis.getComputedStyle = window.getComputedStyle;
if (!globalThis.requestAnimationFrame) globalThis.requestAnimationFrame = window.requestAnimationFrame;
if (!globalThis.cancelAnimationFrame) globalThis.cancelAnimationFrame = window.cancelAnimationFrame;

// Add ResizeObserver polyfill
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class ResizeObserver {
    constructor(callback) {
      this.callback = callback;
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Add IntersectionObserver polyfill
if (!globalThis.IntersectionObserver) {
  globalThis.IntersectionObserver = class IntersectionObserver {
    constructor(callback) {
      this.callback = callback;
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}