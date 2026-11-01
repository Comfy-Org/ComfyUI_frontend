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
import {
  openWorkflowNeedsDeploymentDialog,
  preloadWorkflowNeedsDeploymentDialog
} from '@/platform/workspace/openCustomDeploymentDialog'
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

const stopped: WorkspaceDeployment = {
  ...deployment,
  deployment_id: 'dep-stopped',
  status: 'stopped'
}

const UNSUPPORTED: MissingNodeType[] = [
  { type: 'BiRefNet', cnrId: 'comfyui-birefnet', isReplaceable: false }
]

const RUNS: DeploymentCompatibilityMark = { kind: 'runs' }
const LACKS_BIREFNET: DeploymentCompatibilityMark = {
  kind: 'missing',
  nodeTypes: ['BiRefNet']
}

const cloudMark = shallowRef<DeploymentCompatibilityMark | null>(null)
const deploymentMarks = shallowRef<Record<string, DeploymentCompatibilityMark>>(
  {}
)
const markFor: MarkFor = (id) =>
  id === null ? cloudMark.value : (deploymentMarks.value[id] ?? null)

function checkAnswers(marks: Record<string, DeploymentCompatibilityMark>) {
  deploymentMarks.value = marks
  cloudMark.value = LACKS_BIREFNET
}

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
  useWorkflowStore().activeWorkflow = fromPartial<ActiveWorkflow>({
    path: 'workflows/other.json'
  })
}

describe(noticeMissingNodes, () => {
  beforeEach(() => {
    offered.value = true
    cloudMark.value = null
    deploymentMarks.value = {}
    vi.mocked(openWorkflowNeedsDeploymentDialog).mockReset()
    vi.mocked(openWorkflowNeedsDeploymentDialog).mockResolvedValue(true)
  })

  describe('with the compatibility check on and deployments to check', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.mocked(useFeatureFlags().flags).deploymentCompatibilityMarksEnabled =
        true
      listing(true, null, [deployment, stopped])
      workflowMissing(UNSUPPORTED)
    })

    it.for([
      {
        finds: 'a ready deployment that runs this workflow',
        marks: { 'dep-1': RUNS, 'dep-stopped': LACKS_BIREFNET }
      },
      {
        finds: 'that every deployment lacks its nodes',
        marks: { 'dep-1': LACKS_BIREFNET, 'dep-stopped': LACKS_BIREFNET }
      }
    ])('opens the dialog once the check finds $finds', async ({ marks }) => {
      void noticeMissingNodes(UNSUPPORTED, markFor)
      await vi.advanceTimersByTimeAsync(COMPATIBILITY_WAIT_MS - 1)
      expect(openWorkflowNeedsDeploymentDialog).not.toHaveBeenCalled()

      checkAnswers(marks)
      await vi.advanceTimersByTimeAsync(0)

      expect(openWorkflowNeedsDeploymentDialog).toHaveBeenCalledOnce()
    })

    it.for([
      {
        finds: 'that only a deployment that is not ready runs it',
        marks: { 'dep-1': LACKS_BIREFNET, 'dep-stopped': RUNS }
      },
      {
        finds: 'a deployment it could not check',
        marks: {
          'dep-1': LACKS_BIREFNET,
          'dep-stopped': { kind: 'unknown' }
        }
      }
    ] satisfies {
      finds: string
      marks: Record<string, DeploymentCompatibilityMark>
    }[])('opens no dialog when the check finds $finds', async ({ marks }) => {
      void noticeMissingNodes(UNSUPPORTED, markFor)
      checkAnswers(marks)
      await vi.advanceTimersByTimeAsync(COMPATIBILITY_WAIT_MS)

      expect(openWorkflowNeedsDeploymentDialog).not.toHaveBeenCalled()
    })

    it('opens no dialog when the check answers only after the wait', async () => {
      void noticeMissingNodes(UNSUPPORTED, markFor)
      await vi.advanceTimersByTimeAsync(COMPATIBILITY_WAIT_MS)
      checkAnswers({ 'dep-1': RUNS, 'dep-stopped': LACKS_BIREFNET })
      await vi.advanceTimersByTimeAsync(0)

      expect(openWorkflowNeedsDeploymentDialog).not.toHaveBeenCalled()
    })

    it('opens the dialog at once for an empty listing, without waiting for the check', async () => {
      listing(true, null)

      void noticeMissingNodes(UNSUPPORTED, markFor)
      await vi.advanceTimersByTimeAsync(0)

      expect(openWorkflowNeedsDeploymentDialog).toHaveBeenCalledOnce()
    })

    it('opens no dialog when the check has not answered for this workflow within the wait', async () => {
      cloudMark.value = { kind: 'missing', nodeTypes: ['RMBG'] }

      void noticeMissingNodes(UNSUPPORTED, markFor)
      await vi.advanceTimersByTimeAsync(COMPATIBILITY_WAIT_MS)

      expect(openWorkflowNeedsDeploymentDialog).not.toHaveBeenCalled()
    })

    it('opens no dialog once another workflow is active', async () => {
      void noticeMissingNodes(UNSUPPORTED, markFor)
      anotherWorkflowOpens()
      checkAnswers({ 'dep-1': RUNS, 'dep-stopped': LACKS_BIREFNET })
      await vi.advanceTimersByTimeAsync(COMPATIBILITY_WAIT_MS)

      expect(openWorkflowNeedsDeploymentDialog).not.toHaveBeenCalled()
    })
  })

  it('opens the custom deployment dialog over the error overlay on Comfy Cloud, to a workspace served an empty deployments listing', async () => {
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
    },
    {
      when: 'the workspace has a deployment the compatibility check is off for',
      offer: true,
      boot: null,
      nodes: UNSUPPORTED,
      deployments: [deployment]
    }
  ] satisfies {
    when: string
    offer: boolean
    boot: WorkspaceDeployment | null
    nodes: MissingNodeType[]
    deployments?: WorkspaceDeployment[]
  }[])(
    'shows only the error overlay when $when',
    async ({ offer, boot, nodes, deployments }) => {
      offered.value = offer
      listing(true, boot, deployments)
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
      workflowMissing(UNSUPPORTED)

      const noticed = noticeMissingNodes(UNSUPPORTED, markFor)
      await vi.advanceTimersByTimeAsync(after)
      listing(true, null)
      answer()
      await noticed

      expect(openWorkflowNeedsDeploymentDialog).toHaveBeenCalledTimes(calls)
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
  it.for([
    {
      when: 'the user closed the error overlay',
      meanwhile: () => useExecutionErrorStore().dismissErrorOverlay()
    },
    {
      when: 'another workflow is in front',
      meanwhile: anotherWorkflowOpens
    }
  ])(
    'does not open the dialog when, by the time the listing answers, $when',
    async ({ meanwhile }) => {
      listing(true, null)
      const answer = listingAnswersLater()
      workflowMissing(UNSUPPORTED)

      const noticed = noticeMissingNodes(UNSUPPORTED, markFor)
      meanwhile()
      answer()
      await noticed

      expect(openWorkflowNeedsDeploymentDialog).not.toHaveBeenCalled()
    }
  )

  it('opens no dialog, so shows no load error, when the dialog cannot load', async () => {
    vi.mocked(preloadWorkflowNeedsDeploymentDialog).mockResolvedValueOnce(false)
    listing(true, null)
    workflowMissing(UNSUPPORTED)

    await noticeMissingNodes(UNSUPPORTED, markFor)

    expect(useExecutionErrorStore().isErrorOverlayOpen).toBe(true)
    expect(openWorkflowNeedsDeploymentDialog).not.toHaveBeenCalled()
  })

  it('does not open the dialog over App mode', async () => {
    useWorkflowStore().activeWorkflow = fromPartial<ActiveWorkflow>({
      activeMode: 'app'
    })
    listing(true, null)
    workflowMissing(UNSUPPORTED)

    await noticeMissingNodes(UNSUPPORTED, markFor)

    expect(useExecutionErrorStore().isErrorOverlayOpen).toBe(true)
    expect(openWorkflowNeedsDeploymentDialog).not.toHaveBeenCalled()
  })

  it('opens the dialog on its own once per page for the same missing nodes, and again for others', async () => {
    listing(true, null)
    workflowMissing(UNSUPPORTED)
    await noticeMissingNodes(UNSUPPORTED, markFor)
    await noticeMissingNodes(UNSUPPORTED, markFor)

    expect(openWorkflowNeedsDeploymentDialog).toHaveBeenCalledOnce()

    const others: MissingNodeType[] = [
      { type: 'RMBG', cnrId: 'comfyui-rmbg', isReplaceable: false }
    ]
    workflowMissing(others)
    await noticeMissingNodes(others, markFor)

    expect(openWorkflowNeedsDeploymentDialog).toHaveBeenCalledTimes(2)
    expect(useExecutionErrorStore().isErrorOverlayOpen).toBe(true)
  })

  it('opens the dialog on its own once for the same missing node types, however many nodes use them', async () => {
    const twoNodes: MissingNodeType[] = ['1', '2'].map((nodeId) => ({
      type: 'BiRefNet',
      cnrId: 'comfyui-birefnet',
      isReplaceable: false,
      nodeId
    }))
    listing(true, null)
    workflowMissing(UNSUPPORTED)
    await noticeMissingNodes(UNSUPPORTED, markFor)
    workflowMissing(twoNodes)
    await noticeMissingNodes(twoNodes, markFor)

    expect(openWorkflowNeedsDeploymentDialog).toHaveBeenCalledOnce()
  })
})
