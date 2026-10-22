import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import type { MissingNodeType } from '@/platform/nodeReplacement/types'
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
  created_at: '2026-10-01T00:00:00Z'
}

const UNSUPPORTED: MissingNodeType[] = [
  { type: 'BiRefNet', cnrId: 'comfyui-birefnet', isReplaceable: false }
]

function listing(
  buildsVisible: boolean,
  bootDeployment: WorkspaceDeployment | null
) {
  const store = useDeploymentPickStore()
  store.state = reduceDeploymentPick(
    { phase: 'idle' },
    loadedEvent({ builds_visible: buildsVisible, items: [] })
  )
  store.bootDeployment = bootDeployment
}

describe(noticeMissingNodes, () => {
  beforeEach(() => {
    offered.value = true
    vi.mocked(openWorkflowNeedsDeploymentDialog).mockReset()
    vi.mocked(openWorkflowNeedsDeploymentDialog).mockResolvedValue(true)
  })

  it('offers a custom deployment instead of the overlay on Comfy Cloud, to an account that may create Builds', async () => {
    listing(true, null)

    noticeMissingNodes(UNSUPPORTED)

    await vi.waitFor(() =>
      expect(openWorkflowNeedsDeploymentDialog).toHaveBeenCalledOnce()
    )
    expect(useExecutionErrorStore().isErrorOverlayOpen).toBe(false)
  })

  it.for([
    {
      when: 'the editor is not on Comfy Cloud',
      offer: false,
      builds: true,
      boot: null,
      nodes: UNSUPPORTED
    },
    {
      when: 'it runs on a deployment',
      offer: true,
      builds: true,
      boot: deployment,
      nodes: UNSUPPORTED
    },
    {
      when: 'the account may not create Builds',
      offer: true,
      builds: false,
      boot: null,
      nodes: UNSUPPORTED
    },
    {
      when: 'every missing node has a replacement',
      offer: true,
      builds: true,
      boot: null,
      nodes: [{ type: 'OldSampler', isReplaceable: true }]
    }
  ] satisfies {
    when: string
    offer: boolean
    builds: boolean
    boot: WorkspaceDeployment | null
    nodes: MissingNodeType[]
  }[])(
    'shows the error overlay when $when',
    async ({ offer, builds, boot, nodes }) => {
      offered.value = offer
      listing(builds, boot)

      noticeMissingNodes(nodes)

      await vi.waitFor(() =>
        expect(useExecutionErrorStore().isErrorOverlayOpen).toBe(true)
      )
      expect(openWorkflowNeedsDeploymentDialog).not.toHaveBeenCalled()
    }
  )

  it('falls back to the error overlay when the dialog cannot load', async () => {
    vi.mocked(openWorkflowNeedsDeploymentDialog).mockResolvedValue(false)
    listing(true, null)

    noticeMissingNodes(UNSUPPORTED)

    await vi.waitFor(() =>
      expect(useExecutionErrorStore().isErrorOverlayOpen).toBe(true)
    )
  })
})
