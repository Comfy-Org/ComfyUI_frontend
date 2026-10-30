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

  it('offers a custom deployment instead of the overlay on Comfy Cloud, to an account served the deployments listing', async () => {
    listing(true, null)
    workflowMissing(UNSUPPORTED)

    noticeMissingNodes()

    await vi.waitFor(() =>
      expect(openWorkflowNeedsDeploymentDialog).toHaveBeenCalledOnce()
    )
    expect(useExecutionErrorStore().isErrorOverlayOpen).toBe(false)
  })

  it.for([
    {
      when: 'the editor is not on Comfy Cloud',
      offer: false,
      served: true,
      boot: null,
      nodes: UNSUPPORTED
    },
    {
      when: 'it runs on a deployment',
      offer: true,
      served: true,
      boot: deployment,
      nodes: UNSUPPORTED
    },
    {
      when: 'the deployments listing was not served',
      offer: true,
      served: false,
      boot: null,
      nodes: UNSUPPORTED
    },
    {
      when: 'every missing node has a replacement',
      offer: true,
      served: true,
      boot: null,
      nodes: [{ type: 'OldSampler', isReplaceable: true }]
    }
  ] satisfies {
    when: string
    offer: boolean
    served: boolean
    boot: WorkspaceDeployment | null
    nodes: MissingNodeType[]
  }[])(
    'shows the error overlay when $when',
    async ({ offer, served, boot, nodes }) => {
      offered.value = offer
      listing(served, boot)
      workflowMissing(nodes)

      noticeMissingNodes()

      await vi.waitFor(() =>
        expect(useExecutionErrorStore().isErrorOverlayOpen).toBe(true)
      )
      expect(openWorkflowNeedsDeploymentDialog).not.toHaveBeenCalled()
    }
  )

  it('falls back to the error overlay when the dialog cannot load', async () => {
    vi.mocked(openWorkflowNeedsDeploymentDialog).mockResolvedValue(false)
    listing(true, null)
    workflowMissing(UNSUPPORTED)

    noticeMissingNodes()

    await vi.waitFor(() =>
      expect(useExecutionErrorStore().isErrorOverlayOpen).toBe(true)
    )
  })

  it('shows the error overlay when the deployments listing has not answered in time', async () => {
    vi.useFakeTimers()
    listing(false, null)
    listingAnswersLater()
    workflowMissing(UNSUPPORTED)

    noticeMissingNodes()
    await vi.advanceTimersByTimeAsync(
      DEPLOYMENT_LISTING_MISSING_NODES_WAIT_MS - 1
    )
    expect(useExecutionErrorStore().isErrorOverlayOpen).toBe(false)
    await vi.advanceTimersByTimeAsync(1)

    expect(useExecutionErrorStore().isErrorOverlayOpen).toBe(true)
    expect(openWorkflowNeedsDeploymentDialog).not.toHaveBeenCalled()
  })

  it('does not offer a custom deployment for a workflow that no longer needs one when the listing answers', async () => {
    listing(true, null)
    const answer = listingAnswersLater()
    workflowMissing(UNSUPPORTED)

    noticeMissingNodes()
    workflowMissing([])
    answer()

    await vi.waitFor(() =>
      expect(useExecutionErrorStore().isErrorOverlayOpen).toBe(true)
    )
    expect(openWorkflowNeedsDeploymentDialog).not.toHaveBeenCalled()
  })
})
