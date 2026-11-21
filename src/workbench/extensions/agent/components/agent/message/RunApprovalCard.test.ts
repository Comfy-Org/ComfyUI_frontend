import { render, screen, waitFor } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import type { ApiNodeCostEstimate } from '@comfyorg/shared-frontend-utils/nodePricing'

import { i18n } from '@/i18n'
import {
  agentBoundWorkflowActiveKey,
  agentBoundWorkflowIdKey
} from '@/workbench/extensions/agent/components/agent/agentBoundWorkflowId'

import RunApprovalCard from './RunApprovalCard.vue'

const estimate = ref<ApiNodeCostEstimate | null>(null)

vi.mock(
  import('@/workbench/extensions/agent/composables/useRunCostEstimate'),
  () => ({
    useRunCostEstimate: () => estimate
  })
)

const BOUND_WORKFLOW_ID = 'wf-1'

// 1 USD is 211 credits (CREDITS_PER_USD), so these are round numbers to read.
function costEstimate(
  overrides: Partial<ApiNodeCostEstimate> = {}
): ApiNodeCostEstimate {
  return {
    minUsd: 0,
    maxUsd: 0,
    minCredits: 0,
    maxCredits: 0,
    pricedCount: 0,
    perUnit: [],
    unpriced: [],
    coverage: 'none',
    isLowerBound: false,
    approximate: false,
    ...overrides
  }
}

function renderCard(next: ApiNodeCostEstimate | null) {
  estimate.value = next
  return render(RunApprovalCard, {
    props: {
      part: {
        type: 'runApproval' as const,
        askId: 'ask-1',
        workflowId: BOUND_WORKFLOW_ID
      }
    },
    global: {
      plugins: [i18n],
      provide: {
        [agentBoundWorkflowIdKey as symbol]: ref(BOUND_WORKFLOW_ID),
        [agentBoundWorkflowActiveKey as symbol]: ref(true)
      }
    }
  })
}

const costLine = () => screen.queryByTestId('run-approval-cost')

describe('RunApprovalCard cost estimate', () => {
  it('shows the api-node floor the user is approving against', async () => {
    renderCard(
      costEstimate({
        minUsd: 1,
        maxUsd: 1,
        pricedCount: 2,
        coverage: 'complete'
      })
    )

    await waitFor(() =>
      expect(costLine()).toHaveTextContent('at least 211 credits')
    )
  })

  it('keeps a range as a range', async () => {
    renderCard(
      costEstimate({
        minUsd: 1,
        maxUsd: 2,
        pricedCount: 1,
        coverage: 'complete'
      })
    )

    await waitFor(() =>
      expect(costLine()).toHaveTextContent('at least 211-422 credits')
    )
  })

  // The figure is already a floor, so a partial read needs no extra hedge —
  // what matters is that the excluded node never silently becomes zero.
  it('still shows the floor when a node is priced per unit', async () => {
    renderCard(
      costEstimate({
        minUsd: 1,
        maxUsd: 1,
        pricedCount: 1,
        perUnit: [
          {
            nodeType: 'Gemini',
            price: {
              basis: 'per-unit',
              unit: 'per 1K tokens',
              minUsd: 0.002,
              maxUsd: 0.002,
              approximate: false
            }
          }
        ],
        coverage: 'partial',
        isLowerBound: true
      })
    )

    await waitFor(() =>
      expect(costLine()).toHaveTextContent('at least 211 credits')
    )
  })

  it('says the estimate is unavailable rather than implying free', async () => {
    renderCard(
      costEstimate({
        unpriced: [
          {
            nodeType: 'OpenAIChat',
            price: { basis: 'unpriced', reason: 'descriptive' }
          }
        ],
        coverage: 'none'
      })
    )

    await waitFor(() =>
      expect(costLine()).toHaveTextContent('not available for this workflow')
    )
  })

  // An OSS-only graph still costs GPU time, which nothing prices, so a zero
  // would be wrong where silence is merely incomplete.
  it('claims nothing when the workflow has no api nodes', async () => {
    renderCard(costEstimate())

    expect(
      screen.getByText('Comfy Agent wants to run this workflow.')
    ).toBeInTheDocument()
    expect(costLine()).toBeNull()
  })

  it('claims nothing when the graph cannot be read', async () => {
    renderCard(null)

    expect(costLine()).toBeNull()
  })
})
