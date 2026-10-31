import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import { useMissingNodesErrorStore } from '@/platform/workflowErrors/nodeReplacement/missingNodesErrorStore'
import type { MissingNodeType } from '@/platform/workflowErrors/nodeReplacement/types'
import { DEPLOYMENT_LISTING_MISSING_NODES_WAIT_MS } from '@/platform/workspace/api/deploymentListingTimeouts'
import type { WorkspaceDeployment } from '@/platform/workspace/api/workspaceApi'
import {
  loadedEvent,
  reduceDeploymentPick
} from '@/platform/workspace/deploymentPickState'
import { noticeMissingNodes } from '@/platform/workspace/noticeMissingNodes'
import { openWorkflowNeedsDeploymentDialog } from '@/platform/workspace/openCustomDeploymentDialog'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'

const offered = vi.hoisted(() => ({ value: true }))
vi.mock(
  import('@/platform/workspace/composables/useDeploymentSwitcherOffered'),
  () => ({ useDeploymentSwitcherOffered: () => computed(() => offered.value) })
)

vi.mock(import('@/platform/workspace/openCustomDeploymentDialog'), () => ({
  openCreateCustomDeploymentDialog: vi.fn(),
  openDeployCustomNodesDialog: vi.fn(),
  openWorkflowNeedsDeploymentDialog: vi.fn()
}))

const deployment: WorkspaceDeployment = {
  deployment_id: 'dep-1',
  deployment_name: 'production',
  release_id: 'rel-3',
  status: 'ready',
  created_at: '2026-10-01T00:00:00Z',
  can_start: false
}

const UNSUPPORTED: MissingNodeType[] = [
  { type: 'BiRefNet', cnrId: 'comfyui-birefnet', isReplaceable: false }
]

function listing(served: boolean, bootDeployment: WorkspaceDeployment | null) {
  const store = useDeploymentPickStore()
  store.state = served
    ? reduceDeploymentPick(
        { phase: 'idle' },
        loadedEvent({ builds_visible: true, items: [] })
      )
    : { phase: 'hidden' }
  store.bootDeployment = bootDeployment
}

function workflowMissing(nodeTypes: MissingNodeType[]) {
  useMissingNodesErrorStore().setMissingNodeTypes(nodeTypes)
}

function listingAnswersLater(): () => void {
  let answer = () => {}
  vi.spyOn(useDeploymentPickStore(), 'loadOnce').mockReturnValue(
    new Promise<void>((resolve) => {
      answer = resolve
    })
  )
  return answer
}

describe(noticeMissingNodes, () => {
  beforeEach(() => {
    offered.value = true
    vi.mocked(openWorkflowNeedsDeploymentDialog).mockReset()
    vi.mocked(openWorkflowNeedsDeploymentDialog).mockResolvedValue(true)
  })

  it('opens the custom deployment dialog over the error overlay on Comfy Cloud, to an account served the deployments listing', async () => {
    listing(true, null)
    workflowMissing(UNSUPPORTED)

    await noticeMissingNodes()

    expect(openWorkflowNeedsDeploymentDialog).toHaveBeenCalledOnce()
    expect(useExecutionErrorStore().isErrorOverlayOpen).toBe(true)
  })

  it.for([
    { when: 'the editor is not on Comfy Cloud', offer: false, boot: null },
    { when: 'it runs on a deployment', offer: true, boot: deployment }
  ] satisfies {
    when: string
    offer: boolean
    boot: WorkspaceDeployment | null
  }[])('shows only the error overlay when $when', async ({ offer, boot }) => {
    offered.value = offer
    listing(true, boot)
    workflowMissing(UNSUPPORTED)

    await noticeMissingNodes()

    expect(useExecutionErrorStore().isErrorOverlayOpen).toBe(true)
    expect(openWorkflowNeedsDeploymentDialog).not.toHaveBeenCalled()
  })

  it('shows the error overlay before the deployments listing answers', () => {
    listingAnswersLater()
    listing(true, null)
    workflowMissing(UNSUPPORTED)

    void noticeMissingNodes()

    expect(useExecutionErrorStore().isErrorOverlayOpen).toBe(true)
  })

  it.for([
    {
      answers: 'within the wait',
      after: DEPLOYMENT_LISTING_MISSING_NODES_WAIT_MS - 1,
      opens: true
    },
    {
      answers: 'after the wait',
      after: DEPLOYMENT_LISTING_MISSING_NODES_WAIT_MS,
      opens: false
    }
  ])(
    'opens the dialog only when the deployments listing answers $answers',
    async ({ after, opens }) => {
      vi.useFakeTimers()
      listing(false, null)
      const answer = listingAnswersLater()
      workflowMissing(UNSUPPORTED)

      const noticed = noticeMissingNodes()
      await vi.advanceTimersByTimeAsync(after)
      listing(true, null)
      answer()
      await noticed

      expect(
        vi.mocked(openWorkflowNeedsDeploymentDialog).mock.calls
      ).toHaveLength(opens ? 1 : 0)
    }
  )

  it('does not open the dialog for a workflow that no longer needs one when the listing answers', async () => {
    listing(true, null)
    const answer = listingAnswersLater()
    workflowMissing(UNSUPPORTED)

    const noticed = noticeMissingNodes()
    workflowMissing([])
    answer()
    await noticed

    expect(openWorkflowNeedsDeploymentDialog).not.toHaveBeenCalled()
  })
})
