/**
 * Shared `vi.mock(...)` payloads for tests that exercise
 * `@/services/extension-api-service` against a stubbed World.
 *
 * Why this exists: BC.05 / BC.11 (and any future ECS-touching BC tests)
 * had identical, copy-pasted blocks of:
 *
 *   const mockGetComponent = vi.fn()
 *   const mockEntitiesWith = vi.fn(() => [])
 *   vi.mock('@/world/worldInstance', ...)
 *   vi.mock('@/world/widgets/widgetComponents', ...)
 *   vi.mock('@/world/entityIds', () => ({}))
 *   vi.mock('@/world/componentKey', ...)
 *   vi.mock('@/extension-api/node', () => ({}))
 *   vi.mock('@/extension-api/widget', () => ({}))
 *   vi.mock('@/extension-api/lifecycle', () => ({}))
 *
 * `vi.mock` is statically hoisted, so the *call sites* must remain in
 * the consumer file. What we centralise here is the factory *bodies*
 * plus a handle-creation helper that pairs cleanly with `vi.hoisted`.
 *
 * @example
 *   import { vi } from 'vitest'
 *   import {
 *     createWorldMockHandles,
 *     emptyMockFactory,
 *     componentKeyMockFactory,
 *     widgetComponentsMockFactory,
 *     worldInstanceMockFactory
 *   } from './harness/worldMocks'
 *
 *   const { mockGetComponent, mockEntitiesWith } = vi.hoisted(
 *     createWorldMockHandles
 *   )
 *
 *   vi.mock('@/world/worldInstance', () =>
 *     worldInstanceMockFactory({ mockGetComponent, mockEntitiesWith })
 *   )
 *   vi.mock('@/world/widgets/widgetComponents', widgetComponentsMockFactory)
 *   vi.mock('@/world/entityIds', emptyMockFactory)
 *   vi.mock('@/world/componentKey', componentKeyMockFactory)
 *   vi.mock('@/extension-api/node', emptyMockFactory)
 *   vi.mock('@/extension-api/widget', emptyMockFactory)
 *   vi.mock('@/extension-api/lifecycle', emptyMockFactory)
 */
import { vi } from 'vitest'

export interface WorldMockHandles {
  mockGetComponent: ReturnType<typeof vi.fn>
  mockEntitiesWith: ReturnType<typeof vi.fn>
}

/**
 * Hoist-safe factory for the per-test mock function handles.
 * Wrap with `vi.hoisted(createWorldMockHandles)` at the top of the
 * test file so the resulting handles are available inside the
 * `vi.mock(...)` factory closures.
 */
export function createWorldMockHandles(): WorldMockHandles {
  return {
    mockGetComponent: vi.fn(),
    mockEntitiesWith: vi.fn(() => [])
  }
}

/** Factory body for `@/world/worldInstance`. */
export function worldInstanceMockFactory(handles: WorldMockHandles) {
  return {
    getWorld: () => ({
      getComponent: handles.mockGetComponent,
      entitiesWith: handles.mockEntitiesWith,
      setComponent: vi.fn(),
      removeComponent: vi.fn()
    })
  }
}

/** Factory body for `@/world/widgets/widgetComponents`. */
export function widgetComponentsMockFactory() {
  return {
    WidgetComponentContainer: Symbol('WidgetComponentContainer'),
    WidgetComponentDisplay: Symbol('WidgetComponentDisplay'),
    WidgetComponentSchema: Symbol('WidgetComponentSchema'),
    WidgetComponentSerialize: Symbol('WidgetComponentSerialize'),
    WidgetComponentValue: Symbol('WidgetComponentValue')
  }
}

/** Factory body for `@/world/componentKey`. */
export function componentKeyMockFactory() {
  return {
    defineComponentKey: (name: string) => ({ name })
  }
}

/** Factory body for modules that need to be mocked but contribute nothing. */
export function emptyMockFactory() {
  return {}
}
