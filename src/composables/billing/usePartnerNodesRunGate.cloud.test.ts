import { describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'

import {
  partnerRunGateBlocksAutoQueue,
  usePartnerNodesRunGate
} from './usePartnerNodesRunGate'

vi.mock('@/platform/distribution/types', () => ({ isCloud: true }))

const partnerNodesInGraph = vi.fn()
const scanPartnerNodes = vi.fn(() => [])
vi.mock('@/composables/node/usePartnerNodesInGraph', () => ({
  usePartnerNodesInGraph: () => partnerNodesInGraph(),
  scanPartnerNodesInGraph: () => scanPartnerNodes()
}))

/**
 * Cloud keeps its own subscription-driven gating (CloudRunButtonWrapper); this
 * composable must stay inert there. Without this file the cloud early-returns
 * can be deleted with the rest of the suite still green, because the test
 * environment defaults to a non-cloud distribution.
 */
describe('usePartnerNodesRunGate on cloud', () => {
  it('stays inert and never scans the graph', () => {
    const scope = effectScope()
    const { gate, partnerNodes } = scope.run(() => usePartnerNodesRunGate())!

    expect(gate.value).toBe('none')
    expect(partnerNodes.value).toEqual([])
    expect(partnerNodesInGraph).not.toHaveBeenCalled()

    scope.stop()
  })

  it('never blocks auto-queue and never scans the graph', () => {
    expect(partnerRunGateBlocksAutoQueue()).toBe(false)
    expect(scanPartnerNodes).not.toHaveBeenCalled()
  })
})
