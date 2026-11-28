import { fromPartial } from '@total-typescript/shoehorn'
import { render } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'
import type { Ref } from 'vue'

import { reportError } from '@comfyorg/telemetry/reportError'

import type { ApiNodeCostEstimate } from '@comfyorg/shared-frontend-utils/nodePricing'

import { api } from '@/scripts/api'
import type { useNodePricing } from '@/composables/node/useNodePricing'
import type { ComfyApp } from '@/scripts/app'

import { useRunCostEstimate } from './useRunCostEstimate'
import type { RunCostEstimateState } from './useRunCostEstimate'

const estimateGraphRunCost =
  vi.fn<ReturnType<typeof useNodePricing>['estimateGraphRunCost']>()

vi.mock(import('@/composables/node/useNodePricing'), () => ({
  useNodePricing: () =>
    fromPartial<ReturnType<typeof useNodePricing>>({ estimateGraphRunCost })
}))
vi.mock(import('@/scripts/api'))
vi.mock(import('@/scripts/app'), () => ({
  app: fromPartial<ComfyApp>({ graph: {} })
}))
vi.mock(import('@comfyorg/telemetry/reportError'))

const costEstimate = (minUsd: number): ApiNodeCostEstimate => ({
  minUsd,
  maxUsd: minUsd,
  minCredits: minUsd,
  maxCredits: minUsd,
  pricedCount: 1,
  perUnit: [],
  unpriced: [],
  coverage: 'complete',
  isLowerBound: false,
  approximate: false
})

function mountEstimate(isEstimable: Ref<boolean>) {
  const seen = ref<RunCostEstimateState>({ status: 'idle' })
  render(
    defineComponent({
      setup() {
        const estimate = useRunCostEstimate(isEstimable)
        return () => {
          seen.value = estimate.value
          return null
        }
      }
    })
  )
  return seen
}

const deferredRead = () => {
  let resolve!: (value: ApiNodeCostEstimate) => void
  estimateGraphRunCost.mockReturnValueOnce(
    new Promise<ApiNodeCostEstimate>((r) => {
      resolve = r
    })
  )
  return () => resolve
}

describe('useRunCostEstimate', () => {
  it('reports the estimate while the asked-for workflow is on canvas', async () => {
    estimateGraphRunCost.mockResolvedValue(costEstimate(0.05))

    const seen = mountEstimate(ref(true))
    await nextTick()
    await nextTick()

    expect(seen.value).toEqual({
      status: 'available',
      estimate: costEstimate(0.05)
    })
  })

  it('reports nothing while the asked-for workflow is not on canvas', async () => {
    estimateGraphRunCost.mockResolvedValue(costEstimate(0.05))

    const seen = mountEstimate(ref(false))
    await nextTick()
    await nextTick()

    expect(seen.value).toEqual({ status: 'idle' })
    expect(estimateGraphRunCost).not.toHaveBeenCalled()
  })

  it('does not restore an in-flight figure after the workflow stops being estimable', async () => {
    const resolverOf = deferredRead()
    const isEstimable = ref(true)

    const seen = mountEstimate(isEstimable)
    await nextTick()
    isEstimable.value = false
    await nextTick()
    resolverOf()(costEstimate(0.05))
    await nextTick()
    await nextTick()

    expect(seen.value).toEqual({ status: 'idle' })
  })

  it('reports the failure once and marks the estimate unavailable', async () => {
    const cause = new Error('boom')
    estimateGraphRunCost.mockRejectedValue(cause)

    const seen = mountEstimate(ref(true))
    await nextTick()
    await nextTick()

    expect(seen.value).toEqual({ status: 'unavailable' })
    expect(reportError).toHaveBeenCalledOnce()
    expect(reportError).toHaveBeenCalledWith(
      cause,
      expect.objectContaining({ surface: 'agent' })
    )
  })

  it('refreshes the estimate when the graph changes', async () => {
    estimateGraphRunCost.mockResolvedValue(costEstimate(0.05))

    const seen = mountEstimate(ref(true))
    await nextTick()
    await nextTick()
    expect(seen.value).toEqual({
      status: 'available',
      estimate: costEstimate(0.05)
    })

    estimateGraphRunCost.mockResolvedValue(costEstimate(0.1))
    const apiEvents: EventTarget = api
    apiEvents.dispatchEvent(new Event('graphChanged'))
    await nextTick()
    await nextTick()

    expect(seen.value).toEqual({
      status: 'available',
      estimate: costEstimate(0.1)
    })
  })
})
