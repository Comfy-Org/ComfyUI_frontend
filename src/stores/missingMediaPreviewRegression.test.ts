import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useMissingMediaStore } from '@/platform/missingMedia/missingMediaStore'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import type * as GraphTraversalUtil from '@/utils/graphTraversalUtil'

const mockApp = vi.hoisted(() => ({
  isGraphReady: true,
  nodePreviewImages: {},
  nodeOutputs: {},
  rootGraph: { nodes: [], _nodes: [] } as unknown as LGraph
}))
vi.mock<unknown>(import('@/scripts/app'), () => ({ app: mockApp }))

const mockGetNodeByExecutionId = vi.hoisted(() => vi.fn())
vi.mock(import('@/utils/graphTraversalUtil'), async () => {
  const actual = await vi.importActual<typeof GraphTraversalUtil>(
    '@/utils/graphTraversalUtil'
  )
  return {
    ...actual,
    getNodeByExecutionId: mockGetNodeByExecutionId
  }
})

vi.mock(import('@/i18n'), () => ({
  st: vi.fn((_key: string, fallback: string) => fallback)
}))

vi.mock(import('@/platform/distribution/types'), () => ({ isCloud: false }))

vi.mock<unknown>(
  import('@/platform/missingModel/composables/useMissingModelInteractions'),
  () => ({ clearMissingModelState: vi.fn() })
)

import { useExecutionErrorStore } from './executionErrorStore'

function makeNodeWithPreview(id: number): LGraphNode {
  return {
    id,
    imgs: [{ src: 'blob:mask-edited' }],
    videoContainer: undefined,
    graph: { setDirtyCanvas: vi.fn() }
  } as unknown as LGraphNode
}

describe('FE-230 regression — workflow-load missing-media flagging must not wipe node previews', () => {
  beforeEach(() => {
    mockApp.isGraphReady = true
    mockApp.rootGraph = { nodes: [], _nodes: [] } as unknown as LGraph
    useSettingStore().settingValues['Comfy.RightSidePanel.ShowErrorsTab'] =
      false
  })

  it('does not clear node.imgs when verification flags a Load Image as missing on workflow load (e.g. mask-editor saved value)', async () => {
    const node = makeNodeWithPreview(42)
    mockGetNodeByExecutionId.mockReturnValue(node)

    useExecutionErrorStore()
    const missingMediaStore = useMissingMediaStore()

    missingMediaStore.setMissingMedia([
      {
        nodeId: '42',
        nodeType: 'LoadImage',
        widgetName: 'image',
        mediaType: 'image',
        name: 'clipspace/clipspace-painted-masked-1.png [input]',
        isMissing: true
      }
    ])
    await nextTick()
    await nextTick()

    expect(node.imgs).toEqual([{ src: 'blob:mask-edited' }])
    expect(useNodeOutputStore().removeNodeOutputs).not.toHaveBeenCalled()
  })
})
