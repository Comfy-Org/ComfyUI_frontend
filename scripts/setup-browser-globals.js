// Polyfill browser globals for Node.js context during test imports
import { Window } from 'happy-dom';

// Define build-time constants
if (typeof globalThis.__USE_PROD_CONFIG__ === 'undefined') {
  globalThis.__USE_PROD_CONFIG__ = false;
}

// Create a happy-dom window instance with configurable URL
const defaultUrl = (typeof globalThis.process !== 'undefined' && globalThis.process.env?.HAPPY_DOM_URL) || 'http://localhost:5173/';
const window = new Window({
  url: defaultUrl,
  width: 1024,
  height: 768
});

// Mock location with additional properties for testing
const mockLocation = {
  ...window.location,
  href: defaultUrl,
  origin: new URL(defaultUrl).origin,
  protocol: new URL(defaultUrl).protocol,
  host: new URL(defaultUrl).host,
  hostname: new URL(defaultUrl).hostname,
  port: new URL(defaultUrl).port,
  pathname: new URL(defaultUrl).pathname,
  search: new URL(defaultUrl).search,
  hash: new URL(defaultUrl).hash,
  assign: (url) => {
    console.log(`[Mock] location.assign called with: ${url}`);
    mockLocation.href = url;
  },
  replace: (url) => {
    console.log(`[Mock] location.replace called with: ${url}`);
    mockLocation.href = url;
  },
  reload: () => {
    console.log('[Mock] location.reload called');
  }
};

// Expose DOM globals (only set if not already defined)
if (!globalThis.window) globalThis.window = window;
if (!globalThis.document) globalThis.document = window.document;
if (!globalThis.location) globalThis.location = mockLocation;
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