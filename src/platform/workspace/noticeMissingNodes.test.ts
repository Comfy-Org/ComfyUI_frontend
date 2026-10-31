import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
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
  openWorkflowNeedsDeploymentDialog: vi.fn(async () => true)
}))

type ActiveWorkflow = NonNullable<
  ReturnType<typeof useWorkflowStore>['activeWorkflow']
>

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

function listing(
  served: boolean,
  bootDeployment: WorkspaceDeployment | null,
  items: WorkspaceDeployment[] = []
) {
  const store = useDeploymentPickStore()
  store.state = served
    ? reduceDeploymentPick(
        { phase: 'idle' },
        loadedEvent({ builds_visible: true, items })
      )
    : { phase: 'hidden' }
  store.bootDeployment = bootDeployment
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
  })

  it('opens the custom deployment dialog over the error overlay on Comfy Cloud, to a workspace served an empty deployments listing', async () => {
    listing(true, null)
    useMissingNodesErrorStore().setMissingNodeTypes(UNSUPPORTED)

    await noticeMissingNodes()

    expect(openWorkflowNeedsDeploymentDialog).toHaveBeenCalledOnce()
    expect(useExecutionErrorStore().isErrorOverlayOpen).toBe(true)
  })

  it.for([
    {
      when: 'the editor is not on Comfy Cloud',
      offer: false,
      boot: null,
      deployments: []
    },
    {
      when: 'it runs on a deployment',
      offer: true,
      boot: deployment,
      deployments: []
    },
    {
      when: 'the workspace has a deployment that might run the workflow',
      offer: true,
      boot: null,
      deployments: [deployment]
    }
  ] satisfies {
    when: string
    offer: boolean
    boot: WorkspaceDeployment | null
    deployments: WorkspaceDeployment[]
  }[])(
    'shows only the error overlay when $when',
    async ({ offer, boot, deployments }) => {
      offered.value = offer
      listing(true, boot, deployments)
      useMissingNodesErrorStore().setMissingNodeTypes(UNSUPPORTED)

      await noticeMissingNodes()

      expect(useExecutionErrorStore().isErrorOverlayOpen).toBe(true)
      expect(openWorkflowNeedsDeploymentDialog).not.toHaveBeenCalled()
    }
  )

  it('shows the error overlay before the deployments listing answers', () => {
    listingAnswersLater()
    listing(true, null)
    useMissingNodesErrorStore().setMissingNodeTypes(UNSUPPORTED)

    void noticeMissingNodes()

    expect(useExecutionErrorStore().isErrorOverlayOpen).toBe(true)
  })

  it.for([
    {
      answers: 'within the wait',
      after: DEPLOYMENT_LISTING_MISSING_NODES_WAIT_MS - 1,
      calls: 1
    },
    {
      answers: 'after the wait',
      after: DEPLOYMENT_LISTING_MISSING_NODES_WAIT_MS,
      calls: 0
    }
  ])(
    'opens the dialog only when the deployments listing answers $answers',
    async ({ after, calls }) => {
      vi.useFakeTimers({ shouldAdvanceTime: false })
      listing(false, null)
      const answer = listingAnswersLater()
      useMissingNodesErrorStore().setMissingNodeTypes(UNSUPPORTED)

      const noticed = noticeMissingNodes()
      await vi.advanceTimersByTimeAsync(after)
      listing(true, null)
      answer()
      await noticed

      expect(openWorkflowNeedsDeploymentDialog).toHaveBeenCalledTimes(calls)
    }
  )

  it('does not open the dialog for a workflow that no longer needs one when the listing answers', async () => {
    listing(true, null)
    const answer = listingAnswersLater()
    useMissingNodesErrorStore().setMissingNodeTypes(UNSUPPORTED)

    const noticed = noticeMissingNodes()
    useMissingNodesErrorStore().setMissingNodeTypes([])
    answer()
    await noticed

    expect(openWorkflowNeedsDeploymentDialog).not.toHaveBeenCalled()
  })

  it.for([
    {
      when: 'the user closed the error overlay',
      meanwhile: () => useExecutionErrorStore().dismissErrorOverlay()
    },
    {
      when: 'another workflow is in front',
      meanwhile: () => {
        useWorkflowStore().activeWorkflow = fromPartial<ActiveWorkflow>({
          path: 'workflows/other.json'
        })
      }
    }
  ])(
    'does not open the dialog when, by the time the listing answers, $when',
    async ({ meanwhile }) => {
      listing(true, null)
      const answer = listingAnswersLater()
      useMissingNodesErrorStore().setMissingNodeTypes(UNSUPPORTED)

      const noticed = noticeMissingNodes()
      meanwhile()
      answer()
      await noticed

      expect(openWorkflowNeedsDeploymentDialog).not.toHaveBeenCalled()
    }
  )

  it('does not open the dialog over App mode', async () => {
    useWorkflowStore().activeWorkflow = fromPartial<ActiveWorkflow>({
      activeMode: 'app'
    })
    listing(true, null)
    useMissingNodesErrorStore().setMissingNodeTypes(UNSUPPORTED)

    await noticeMissingNodes()

    expect(useExecutionErrorStore().isErrorOverlayOpen).toBe(true)
    expect(openWorkflowNeedsDeploymentDialog).not.toHaveBeenCalled()
  })

  it('opens the dialog on its own once per page for the same missing nodes, and again for others', async () => {
    listing(true, null)
    useMissingNodesErrorStore().setMissingNodeTypes(UNSUPPORTED)
    await noticeMissingNodes()
    await noticeMissingNodes()

    expect(openWorkflowNeedsDeploymentDialog).toHaveBeenCalledOnce()

    useMissingNodesErrorStore().setMissingNodeTypes([
      { type: 'RMBG', cnrId: 'comfyui-rmbg', isReplaceable: false }
    ])
    await noticeMissingNodes()

    expect(openWorkflowNeedsDeploymentDialog).toHaveBeenCalledTimes(2)
    expect(useExecutionErrorStore().isErrorOverlayOpen).toBe(true)
  })
})
