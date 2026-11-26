import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'

import { useMissingNodesErrorStore } from '@/platform/workflowErrors/nodeReplacement/missingNodesErrorStore'
import { useWorkflowNeedsDeployment } from '@/platform/workspace/composables/useCustomDeploymentOffered'
import { useCustomDeploymentSetup } from '@/platform/workspace/composables/useCustomDeploymentSetup'
import { useMissingNodeDeploymentOffer } from '@/platform/workspace/composables/useMissingNodeDeploymentOffer'
import {
  loadedEvent,
  reduceDeploymentPick
} from '@/platform/workspace/deploymentPickState'
import { openWorkflowNeedsDeploymentDialog } from '@/platform/workspace/openCustomDeploymentDialog'
import { usePlatformFrameStore } from '@/platform/workspace/platformFrame/platformFrameStore'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'

vi.mock(import('@/platform/workspace/composables/useCustomDeploymentOffered'))
vi.mock(
  import('@/platform/workspace/composables/useMissingNodeDeploymentOffer')
)
vi.mock(import('@/platform/workspace/openCustomDeploymentDialog'))

type Offer = ReturnType<typeof useMissingNodeDeploymentOffer>['offer']['value']

const offer = ref<Offer>(null)
const needsDeployment = ref(true)

function loadDeployments(ids: string[]) {
  useDeploymentPickStore().state = reduceDeploymentPick(
    { phase: 'idle' },
    loadedEvent({
      builds_visible: true,
      items: ids.map((id) => ({
        deployment_id: id,
        deployment_name: id,
        release_id: `rel-${id}`,
        status: 'ready',
        created_at: '2026-10-01T00:00:00Z',
        can_start: false
      }))
    })
  )
}

beforeEach(() => {
  offer.value = null
  needsDeployment.value = true
  vi.mocked(useWorkflowNeedsDeployment).mockReturnValue(
    computed(() => needsDeployment.value)
  )
  vi.mocked(useMissingNodeDeploymentOffer).mockReturnValue({
    offer: computed(() => offer.value)
  } as ReturnType<typeof useMissingNodeDeploymentOffer>)
  vi.mocked(openWorkflowNeedsDeploymentDialog).mockResolvedValue(true)
})

describe('useCustomDeploymentSetup', () => {
  it('offers a custom deployment when the workspace has no deployments', () => {
    loadDeployments([])

    expect(useCustomDeploymentSetup().offered.value).toBe(true)
  })

  it('offers a custom deployment once no deployment runs the workflow', () => {
    loadDeployments(['production'])
    const { offered } = useCustomDeploymentSetup()

    expect(offered.value).toBe(false)

    offer.value = { kind: 'none' }

    expect(offered.value).toBe(true)
  })

  it('offers nothing when the workflow needs no deployment', () => {
    needsDeployment.value = false
    loadDeployments([])

    expect(useCustomDeploymentSetup().offered.value).toBe(false)
  })

  it('opens the workflow deployment dialog from the errors panel', () => {
    const open = vi.spyOn(usePlatformFrameStore(), 'open')

    useCustomDeploymentSetup().setUp()

    expect(openWorkflowNeedsDeploymentDialog).toHaveBeenCalledExactlyOnceWith(
      'errors_panel'
    )
    expect(open).not.toHaveBeenCalled()
  })

  it.for([
    {
      missing: 'only custom nodes with no replacement',
      nodeTypes: [
        {
          type: 'VHS_VideoCombine',
          cnrId: 'comfyui-videohelpersuite',
          isReplaceable: false
        }
      ],
      covers: true
    },
    {
      missing: 'a core node beside a custom node',
      nodeTypes: [
        {
          type: 'VHS_VideoCombine',
          cnrId: 'comfyui-videohelpersuite',
          isReplaceable: false
        },
        { type: 'NewCoreNode', cnrId: 'comfy-core', isReplaceable: false }
      ],
      covers: false
    },
    {
      missing: 'a node from an unknown pack',
      nodeTypes: ['UnknownNode'],
      covers: false
    },
    {
      missing: 'a custom node with no pack id',
      nodeTypes: [{ type: 'QwenImage21Cache', isReplaceable: false }],
      covers: false
    }
  ])(
    'a custom deployment covers every missing node with $missing: $covers',
    ({ nodeTypes, covers }) => {
      useMissingNodesErrorStore().setMissingNodeTypes(nodeTypes)

      expect(useCustomDeploymentSetup().coversEveryMissingNode.value).toBe(
        covers
      )
    }
  )
})
