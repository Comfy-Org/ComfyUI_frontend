import { fromPartial } from '@total-typescript/shoehorn'
import { vi } from 'vitest'

import type { layoutStore as RealLayoutStore } from '../layoutStore'

/** Inert layout store for tests that exercise canvas behavior. */
export const layoutStore = fromPartial<typeof RealLayoutStore>({
  allocateZIndex: vi.fn(() => 1),
  applyOperation: vi.fn(() => 'applied'),
  applyOperations: vi.fn(() => 'applied'),
  batchUpdateNodeBounds: vi.fn(),
  clearGraph: vi.fn(),
  clearViewGeometry: vi.fn(),
  geometryVersion: 0,
  getAllGroups: vi.fn(() => ({ value: new Map() })),
  getCurrentActor: vi.fn(() => 'test-actor'),
  getCurrentSource: vi.fn(() => 'canvas'),
  getGroupLayout: vi.fn(() => null),
  getLinkLayout: vi.fn(() => null),
  getNodeLayoutRef: vi.fn(() => ({ value: null })),
  getRerouteLayout: vi.fn(() => null),
  getRegistrationId: vi.fn(() => undefined),
  getSlotLayout: vi.fn(() => null),
  getVersion: vi.fn(() => ({ value: 0 })),
  hasSlotLayouts: false,
  onChange: vi.fn(() => () => {}),
  onNodeChange: vi.fn(() => () => {}),
  pendingSlotSync: false,
  queryLinkAtPoint: vi.fn(() => null),
  queryLinkSegmentAtPoint: vi.fn(() => null),
  queryRerouteAtPoint: vi.fn(() => null),
  querySlotAtPoint: vi.fn(() => null),
  readNodeRect: vi.fn(() => false),
  setActor: vi.fn(),
  setPendingSlotSync: vi.fn(),
  setSource: vi.fn()
})
