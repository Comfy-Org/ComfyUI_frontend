import { fromPartial } from '@total-typescript/shoehorn'
import { vi } from 'vitest'

import type { layoutStore as RealLayoutStore } from '../layoutStore'

/** Inert layout store for tests that exercise canvas behavior. */
export const layoutStore = fromPartial<typeof RealLayoutStore>({
  allocateZIndex: vi.fn(() => 1),
  applyOperation: vi.fn(() => 'applied'),
  applyOperations: vi.fn(() => 'applied'),
  batchUpdateNodeBounds: vi.fn(),
  clearViewGeometry: vi.fn(),
  geometryVersion: 0,
  getAllGroups: vi.fn(() => ({ value: new Map() })),
  getGroupLayout: vi.fn(() => null),
  getLinkLayout: vi.fn(() => null),
  getNodeLayout: vi.fn(() => null),
  getNodeLayoutRef: vi.fn(() => ({ value: null })),
  getRerouteLayout: vi.fn(() => null),
  getSlotOffset: vi.fn(() => null),
  getVersion: vi.fn(() => ({ value: 0 })),
  onChange: vi.fn(() => () => {}),
  onGeometryChange: vi.fn(() => () => {}),
  onNodeChange: vi.fn(() => () => {}),
  queryLinkAtPoint: vi.fn(() => null),
  queryLinkSegmentAtPoint: vi.fn(() => null),
  queryRerouteAtPoint: vi.fn(() => null),
  readNodeRect: vi.fn(() => false),
  contentSizeOf: vi.fn(() => undefined),
  updateNodeSlotOffsets: vi.fn()
})
