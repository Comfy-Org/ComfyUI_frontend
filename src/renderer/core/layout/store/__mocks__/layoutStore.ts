import { fromPartial } from '@total-typescript/shoehorn'
import { vi } from 'vitest'

import type * as layoutStoreModule from '../layoutStore'

/** The real singleton's type, so the stub tracks the store's own surface. */
type RealLayoutStore = typeof layoutStoreModule.layoutStore

/**
 * Inert stand-in for the layout store, for suites that exercise canvas code
 * incidentally touching layout. Enable with a bare
 * `vi.mock('@/renderer/core/layout/store/layoutStore')`, then set per-test
 * behaviour through `vi.mocked(layoutStore.someMethod)`.
 *
 * Keep every method the store exposes here. A partial stub reads as
 * "this suite needs these three calls" right up until production adds a
 * fourth, and then it fails as a missing function rather than a clear signal.
 */
export const layoutStore = fromPartial<RealLayoutStore>({
  allocateZIndex: vi.fn(() => 1),
  applyOperation: vi.fn(),
  batchUpdateNodeBounds: vi.fn(),
  clearViewGeometry: vi.fn(),
  getAllGroups: vi.fn(() => ({ value: new Map() })),
  getAllNodes: vi.fn(() => ({ value: new Map() })),
  getCurrentActor: vi.fn(() => 'test-actor'),
  getCurrentSource: vi.fn(() => 'canvas'),
  getGroupLayout: vi.fn(() => null),
  getLinkLayout: vi.fn(() => null),
  getNodeLayoutRef: vi.fn(() => ({ value: null })),
  getNodesInBounds: vi.fn(() => ({ value: [] })),
  getRerouteLayout: vi.fn(() => null),
  getSlotLayout: vi.fn(() => null),
  getVersion: vi.fn(() => ({ value: 0 })),
  hasSlotLayouts: false,
  onChange: vi.fn(() => () => {}),
  onNodeChange: vi.fn(() => () => {}),
  pendingSlotSync: false,
  queryItemsInBounds: vi.fn(() => ({
    nodes: [],
    links: [],
    slots: [],
    reroutes: []
  })),
  queryLinkAtPoint: vi.fn(() => null),
  queryLinkSegmentAtPoint: vi.fn(() => null),
  queryNodeAtPoint: vi.fn(() => null),
  queryNodesInBounds: vi.fn(() => []),
  queryRerouteAtPoint: vi.fn(() => null),
  querySlotAtPoint: vi.fn(() => null),
  setActor: vi.fn(),
  setPendingSlotSync: vi.fn(),
  setSource: vi.fn()
})
