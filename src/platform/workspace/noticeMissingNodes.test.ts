import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, shallowRef } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useMissingNodesErrorStore } from '@/platform/workflowErrors/nodeReplacement/missingNodesErrorStore'
import type { MissingNodeType } from '@/platform/workflowErrors/nodeReplacement/types'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { DEPLOYMENT_LISTING_MISSING_NODES_WAIT_MS } from '@/platform/workspace/api/deploymentListingTimeouts'
import type { WorkspaceDeployment } from '@/platform/workspace/api/workspaceApi'
import type { DeploymentCompatibilityMark } from '@/platform/workspace/composables/useDeploymentCompatibility'
import {
  loadedEvent,
  reduceDeploymentPick
} from '@/platform/workspace/deploymentPickState'
import {
  COMPATIBILITY_WAIT_MS,
  noticeMissingNodes
} from '@/platform/workspace/noticeMissingNodes'
import { openWorkflowNeedsDeploymentDialog } from '@/platform/workspace/openCustomDeploymentDialog'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import type { MarkFor } from '@/platform/workspace/workflowDeploymentOffer'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'

vi.mock(import('@/composables/useFeatureFlags'))

const offered = vi.hoisted(() => ({ value: true }))
vi.mock(
  import('@/platform/workspace/composables/useDeploymentSwitcherOffered'),
  () => ({ useDeploymentSwitcherOffered: () => computed(() => offered.value) })
)

vi.mock(import('@/platform/workspace/openCustomDeploymentDialog'), () => ({
  openCreateCustomDeploymentDialog: vi.fn(),
  openDeployCustomNodesDialog: vi.fn(),
  openWorkflowNeedsDeploymentDialog: vi.fn(),
  preloadWorkflowNeedsDeploymentDialog: vi.fn(async () => true)
}))

vi.mock(import('@/platform/workspace/openWorkflowForCheck'), () => ({
  openWorkflowForCheck: () => ({
    nodeTypes: ['BiRefNet', 'EmptyImage', 'SaveImage'],
    missingNodeTypes: ['BiRefNet']
  })
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

const cloudMark = shallowRef<DeploymentCompatibilityMark | null>(null)
const markFor: MarkFor = (id) => (id === null ? cloudMark.value : null)

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

function anotherWorkflowOpens() {
  useWorkflowStore().activeWorkflow = fromPartial<
    NonNullable<ReturnType<typeof useWorkflowStore>['activeWorkflow']>
  >({ path: 'workflows/other.json' })
}

describe(noticeMissingNodes, () => {
  beforeEach(() => {
    offered.value = true
    cloudMark.value = null
    vi.mocked(openWorkflowNeedsDeploymentDialog).mockReset()
    vi.mocked(openWorkflowNeedsDeploymentDialog).mockResolvedValue(true)
  })

  describe('with the compatibility check on and deployments to check', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.mocked(useFeatureFlags().flags).deploymentCompatibilityMarksEnabled =
        true
      listing(true, null, [deployment])
      workflowMissing(UNSUPPORTED)
    })

    it('opens the dialog once the check answers for this workflow', async () => {
      void noticeMissingNodes(UNSUPPORTED, markFor)
      await vi.advanceTimersByTimeAsync(COMPATIBILITY_WAIT_MS - 1)
      expect(openWorkflowNeedsDeploymentDialog).not.toHaveBeenCalled()

      cloudMark.value = { kind: 'missing', nodeTypes: ['BiRefNet'] }
      await vi.advanceTimersByTimeAsync(0)

      expect(openWorkflowNeedsDeploymentDialog).toHaveBeenCalledOnce()
    })

    it('waits past an answer for another workflow, then opens without the check', async () => {
      cloudMark.value = { kind: 'missing', nodeTypes: ['RMBG'] }

      void noticeMissingNodes(UNSUPPORTED, markFor)
      await vi.advanceTimersByTimeAsync(COMPATIBILITY_WAIT_MS - 1)
      expect(openWorkflowNeedsDeploymentDialog).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(1)

      expect(openWorkflowNeedsDeploymentDialog).toHaveBeenCalledOnce()
    })

    it('opens no dialog once another workflow is active', async () => {
      void noticeMissingNodes(UNSUPPORTED, markFor)
      anotherWorkflowOpens()
      await vi.advanceTimersByTimeAsync(COMPATIBILITY_WAIT_MS)

      expect(openWorkflowNeedsDeploymentDialog).not.toHaveBeenCalled()
    })
  })

  it('opens the custom deployment dialog over the error overlay on Comfy Cloud, to an account served the deployments listing', async () => {
    listing(true, null)
    workflowMissing(UNSUPPORTED)

    await noticeMissingNodes(UNSUPPORTED, markFor)

    expect(openWorkflowNeedsDeploymentDialog).toHaveBeenCalledOnce()
    expect(useExecutionErrorStore().isErrorOverlayOpen).toBe(true)
  })

  it.for([
    {
      when: 'the editor is not on Comfy Cloud',
      offer: false,
      boot: null,
      nodes: UNSUPPORTED
    },
    {
      when: 'it runs on a deployment',
      offer: true,
      boot: deployment,
      nodes: UNSUPPORTED
    },
    {
      when: 'every missing node has a replacement',
      offer: true,
      boot: null,
      nodes: [{ type: 'OldSampler', isReplaceable: true }]
    }
  ] satisfies {
    when: string
    offer: boolean
    boot: WorkspaceDeployment | null
    nodes: MissingNodeType[]
  }[])(
    'shows only the error overlay when $when',
    async ({ offer, boot, nodes }) => {
      offered.value = offer
      listing(true, boot)
      workflowMissing(nodes)

      await noticeMissingNodes(nodes, markFor)

      expect(useExecutionErrorStore().isErrorOverlayOpen).toBe(true)
      expect(openWorkflowNeedsDeploymentDialog).not.toHaveBeenCalled()
    }
  )

  it('shows the error overlay before the deployments listing answers', () => {
    listingAnswersLater()
    listing(true, null)
    workflowMissing(UNSUPPORTED)

    void noticeMissingNodes(UNSUPPORTED, markFor)

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

      const noticed = noticeMissingNodes(UNSUPPORTED, markFor)
      await vi.advanceTimersByTimeAsync(after)
      listing(true, null)
      answer()
      await noticed

      expect(
        vi.mocked(openWorkflowNeedsDeploymentDialog).mock.calls
      ).toHaveLength(opens ? 1 : 0)
    }
  )

  it('opens no dialog for a workflow no longer active when the deployments listing never answers', async () => {
    vi.useFakeTimers()
    listing(true, null)
    listingAnswersLater()
    workflowMissing(UNSUPPORTED)

    const noticed = noticeMissingNodes(UNSUPPORTED, markFor)
    anotherWorkflowOpens()
    await vi.advanceTimersByTimeAsync(DEPLOYMENT_LISTING_MISSING_NODES_WAIT_MS)
    await noticed

    expect(openWorkflowNeedsDeploymentDialog).not.toHaveBeenCalled()
  })

  it('does not open the dialog for a workflow that no longer needs one when the listing answers', async () => {
    listing(true, null)
    const answer = listingAnswersLater()
    workflowMissing(UNSUPPORTED)

    const noticed = noticeMissingNodes(UNSUPPORTED, markFor)
    workflowMissing([])
    answer()
    await noticed

    expect(openWorkflowNeedsDeploymentDialog).not.toHaveBeenCalled()
  })
})
