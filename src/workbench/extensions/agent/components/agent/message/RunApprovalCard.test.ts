import { render, screen, waitFor } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import type { ApiNodeCostEstimate } from '@comfyorg/shared-frontend-utils/nodePricing'

import { i18n } from '@/i18n'
import {
  agentBoundWorkflowActiveKey,
  agentBoundWorkflowIdKey
} from '@/workbench/extensions/agent/components/agent/agentBoundWorkflowId'
import type { RunCostEstimateState } from '@/workbench/extensions/agent/composables/useRunCostEstimate'

import RunApprovalCard from './RunApprovalCard.vue'

let estimateState = ref<RunCostEstimateState>({ status: 'idle' })

vi.mock(
  import('@/workbench/extensions/agent/composables/useRunCostEstimate'),
  () => ({
    useRunCostEstimate: () => estimateState
  })
)

const BOUND_WORKFLOW_ID = 'wf-1'

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

function renderCard(next: RunCostEstimateState) {
  estimateState = ref(next)
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
const card = () => screen.getByTestId('run-approval-card')

describe('RunApprovalCard cost estimate', () => {
  it('shows the api-node floor the user is approving against', async () => {
    renderCard({
      status: 'available',
      estimate: costEstimate({
        minUsd: 1,
        maxUsd: 1,
        pricedCount: 2,
        coverage: 'complete'
      })
    })

    await waitFor(() =>
      expect(costLine()).toHaveTextContent('at least 211 credits')
    )
  })

  it('keeps a range as a range', async () => {
    renderCard({
      status: 'available',
      estimate: costEstimate({
        minUsd: 1,
        maxUsd: 2,
        pricedCount: 1,
        coverage: 'complete'
      })
    })

    await waitFor(() =>
      expect(costLine()).toHaveTextContent('at least 211-422 credits')
    )
  })

  it('still shows the floor when a node is priced per unit, never a zero', async () => {
    renderCard({
      status: 'available',
      estimate: costEstimate({
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
    })

    await waitFor(() =>
      expect(costLine()).toHaveTextContent('at least 211 credits')
    )
  })

  it('shows no cost line when no api node can be priced', async () => {
    renderCard({
      status: 'available',
      estimate: costEstimate({
        unpriced: [
          {
            nodeType: 'OpenAIChat',
            price: { basis: 'unpriced', reason: 'descriptive' }
          }
        ],
        coverage: 'none'
      })
    })

    expect(
      screen.getByText('Comfy Agent wants to run this workflow.')
    ).toBeInTheDocument()
    expect(card()).toHaveAttribute('data-cost-estimate', 'available')
    expect(costLine()).toBeNull()
  })

  it('claims nothing when the workflow has no api nodes', async () => {
    renderCard({ status: 'available', estimate: costEstimate() })

    expect(
      screen.getByText('Comfy Agent wants to run this workflow.')
    ).toBeInTheDocument()
    expect(costLine()).toBeNull()
  })

  it('claims nothing before the graph is read', async () => {
    renderCard({ status: 'idle' })

    expect(card()).toHaveAttribute('data-cost-estimate', 'idle')
    expect(costLine()).toBeNull()
  })

  it('shows no cost line after estimation fails and keeps Run enabled', async () => {
    renderCard({ status: 'unavailable' })

    expect(card()).toHaveAttribute('data-cost-estimate', 'unavailable')
    expect(costLine()).toBeNull()
    expect(screen.getByRole('button', { name: 'Run' })).toBeEnabled()
  })
})
