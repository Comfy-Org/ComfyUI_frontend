import { vi } from 'vitest'

import type {
  getExtraOptionsForWidget as realGetExtraOptionsForWidget,
  useLitegraphService as realUseLitegraphService
} from '../litegraphService'

export const CONFIG = Symbol()
export const GET_CONFIG = Symbol()

export const getExtraOptionsForWidget = vi.fn<
  typeof realGetExtraOptionsForWidget
>(() => [])

const litegraphService: ReturnType<typeof realUseLitegraphService> = {
  registerNodeDef: vi.fn(async () => {}),
  registerSubgraphNodeDef: vi.fn(),
  addNodeOnGraph: vi.fn(() => null),
  addNodeInput: vi.fn(),
  getCanvasCenter: vi.fn(() => [0, 0] satisfies [number, number]),
  getExtraOptionsForWidget,
  goToNode: vi.fn(),
  resetView: vi.fn(),
  fitView: vi.fn(),
  updatePreviews: vi.fn()
}

export const useLitegraphService = vi.fn(() => litegraphService)
