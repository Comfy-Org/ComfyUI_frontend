import type {
  LocationQuery,
  Router,
  RouteLocationNormalizedLoaded
} from 'vue-router'
import { ref } from 'vue'
import type { Ref } from 'vue'
import { vi } from 'vitest'

export interface MockRouterOptions {
  query?: LocationQuery
  path?: string
  name?: string | symbol
  params?: Record<string, string | string[]>
}

/**
 * Creates a mock Vue Router instance for testing
 */
export function createMockRouter(options: MockRouterOptions = {}): Router {
  const currentRoute: Ref<RouteLocationNormalizedLoaded> = ref({
    name: options.name || 'home',
    path: options.path || '/',
    params: options.params || {},
    query: options.query || {},
    hash: '',
    fullPath: options.path || '/',
    matched: [],
    meta: {},
    redirectedFrom: undefined
  }) as Ref<RouteLocationNormalizedLoaded>

  return {
    currentRoute,
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    go: vi.fn(),
    beforeEach: vi.fn(),
    beforeResolve: vi.fn(),
    afterEach: vi.fn(),
    install: vi.fn(),
    resolve: vi.fn(),
    addRoute: vi.fn(),
    removeRoute: vi.fn(),
    hasRoute: vi.fn(),
    getRoutes: vi.fn(() => []),
    isReady: vi.fn(() => Promise.resolve()),
    onError: vi.fn(),
    options: {
      history: {} as any,
      routes: []
    }
  } as unknown as Router
}

/**
 * Creates a mock route object for testing
 */
export function createMockRoute(
  options: MockRouterOptions = {}
): RouteLocationNormalizedLoaded {
  return {
    name: options.name || 'home',
    path: options.path || '/',
    params: options.params || {},
    query: options.query || {},
    hash: '',
    fullPath: options.path || '/',
    matched: [],
    meta: {},
    redirectedFrom: undefined
  } as RouteLocationNormalizedLoaded
}
