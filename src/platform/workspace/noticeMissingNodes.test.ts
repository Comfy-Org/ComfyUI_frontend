import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, shallowRef } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import type { MissingNodeType } from '@/platform/workflowErrors/nodeReplacement/types'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
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
  created_at: '2026-10-01T00:00:00Z'
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
    })

    it('opens the dialog once the check answers for this workflow', async () => {
      noticeMissingNodes(UNSUPPORTED, markFor)
      await vi.advanceTimersByTimeAsync(COMPATIBILITY_WAIT_MS - 1)
      expect(openWorkflowNeedsDeploymentDialog).not.toHaveBeenCalled()

      cloudMark.value = { kind: 'missing', nodeTypes: ['BiRefNet'] }
      await vi.advanceTimersByTimeAsync(0)

      expect(openWorkflowNeedsDeploymentDialog).toHaveBeenCalledOnce()
    })

    it('waits past an answer for another workflow, then opens without the check', async () => {
      cloudMark.value = { kind: 'missing', nodeTypes: ['RMBG'] }

      noticeMissingNodes(UNSUPPORTED, markFor)
      await vi.advanceTimersByTimeAsync(COMPATIBILITY_WAIT_MS - 1)
      expect(openWorkflowNeedsDeploymentDialog).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(1)

      expect(openWorkflowNeedsDeploymentDialog).toHaveBeenCalledOnce()
    })

    it('shows neither the dialog nor the overlay once another workflow is active', async () => {
      noticeMissingNodes(UNSUPPORTED, markFor)
      useWorkflowStore().activeWorkflow = fromPartial<
        NonNullable<ReturnType<typeof useWorkflowStore>['activeWorkflow']>
      >({ path: 'workflows/other.json' })
      await vi.advanceTimersByTimeAsync(COMPATIBILITY_WAIT_MS)

      expect(openWorkflowNeedsDeploymentDialog).not.toHaveBeenCalled()
      expect(useExecutionErrorStore().isErrorOverlayOpen).toBe(false)
    })
  })

  it('offers a custom deployment instead of the overlay on Comfy Cloud, to an account served the deployments listing', async () => {
    listing(true, null)

    noticeMissingNodes(UNSUPPORTED, markFor)

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

      noticeMissingNodes(nodes, markFor)

      await vi.waitFor(() =>
        expect(useExecutionErrorStore().isErrorOverlayOpen).toBe(true)
      )
      expect(openWorkflowNeedsDeploymentDialog).not.toHaveBeenCalled()
    }
  )

  it('falls back to the error overlay when the dialog cannot load', async () => {
    vi.mocked(openWorkflowNeedsDeploymentDialog).mockResolvedValue(false)
    listing(true, null)

    noticeMissingNodes(UNSUPPORTED, markFor)

    await vi.waitFor(() =>
      expect(useExecutionErrorStore().isErrorOverlayOpen).toBe(true)
    )
  })
})
