import { render } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'
import type { Ref } from 'vue'

import type { ApiNodeCostEstimate } from '@comfyorg/shared-frontend-utils/nodePricing'

import { useRunCostEstimate } from './useRunCostEstimate'

const estimateGraphRunCost = vi.fn()

vi.mock<unknown>(import('@/composables/node/useNodePricing'), () => ({
  useNodePricing: () => ({ estimateGraphRunCost })
}))
vi.mock(import('@/scripts/api'))
vi.mock<unknown>(import('@/scripts/app'), () => ({ app: { graph: {} } }))

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
  const seen = ref<ApiNodeCostEstimate | null>(null)
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

    expect(seen.value).toEqual(costEstimate(0.05))
  })

  it('reports nothing while the asked-for workflow is not on canvas', async () => {
    estimateGraphRunCost.mockResolvedValue(costEstimate(0.05))

    const seen = mountEstimate(ref(false))
    await nextTick()
    await nextTick()

    expect(seen.value).toBeNull()
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

    expect(seen.value).toBeNull()
  })
})
