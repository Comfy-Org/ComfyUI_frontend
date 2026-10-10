import { fromPartial } from '@total-typescript/shoehorn'
import { render } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { markRaw, ref } from 'vue'
import { createI18n } from 'vue-i18n'

vi.mock(import('@vueuse/router'), () => ({ useRouteHash: () => ref('') }))

const mockAssert = vi.hoisted(() => vi.fn())

vi.mock(import('@/base/assert'), () => ({ assert: mockAssert }))
vi.mock(import('@/scripts/app'))
vi.mock(import('@/scripts/api'), () => ({
  api: fromPartial<ComfyApi>({
    dispatchCustomEvent: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  })
}))
vi.mock(
  import('@/renderer/extensions/layerEditor/composables/useLayerEditorSession'),
  () => ({
    isTextEditingTarget: () => false,
    useLayerEditorSession: () =>
      fromPartial<ReturnType<typeof useLayerEditorSession>>({
        canUndo: { value: false },
        dispose: vi.fn(),
        editor: {
          floating: () => null,
          history: { canUndo: () => false, canRedo: () => false }
        }
      })
  })
)
vi.mock(
  import('@/renderer/extensions/compositor/composables/compositorSession'),
  () => ({ loadCompositorSession: vi.fn().mockResolvedValue(0) })
)
vi.mock(
  import('@/renderer/extensions/compositor/composables/useCompositorAutoSave'),
  () => ({ useCompositorAutoSave: vi.fn(() => ({ stop: vi.fn() })) })
)

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import LayerEditorContent from '@/renderer/extensions/layerEditor/components/LayerEditorContent.vue'
import type { useLayerEditorSession } from '@/renderer/extensions/layerEditor/composables/useLayerEditorSession'
import type { ComfyApi } from '@/scripts/api'
import { ChangeTracker } from '@/scripts/changeTracker'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { toNodeId } from '@/types/nodeId'

let pathCounter = 0

function createTracker() {
  const workflow = fromPartial<ConstructorParameters<typeof ChangeTracker>[0]>({
    path: `/test/layer-editor-${++pathCounter}.json`
  })
  return markRaw(
    new ChangeTracker(workflow, {
      nodes: [],
      links: []
    } as unknown as ComfyWorkflowJSON)
  )
}

function activate(tracker: ChangeTracker) {
  useWorkflowStore().activeWorkflow = fromPartial({ changeTracker: tracker })
}

const stubs = {
  Teleport: true,
  LayerEditorCanvas: true,
  LayerEditorToolbar: true,
  LayerPanel: true,
  LayerPropertiesPanel: true
}

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {} } })

describe('LayerEditorContent with a real ChangeTracker', () => {
  beforeEach(() => {
    ChangeTracker.isLoadingGraph = false
  })

  it('does not assert when the workflow stays active until close', () => {
    activate(createTracker())
    const { unmount } = render(LayerEditorContent, {
      props: {
        node: { id: toNodeId(1) } as unknown as LGraphNode,
        mode: 'compositor'
      },
      global: { plugins: [i18n], stubs }
    })

    unmount()

    expect(mockAssert).not.toHaveBeenCalled()
  })

  it('closes without asserting when another workflow became active while open', () => {
    const owner = createTracker()
    activate(owner)
    const { unmount } = render(LayerEditorContent, {
      props: {
        node: { id: toNodeId(1) } as unknown as LGraphNode,
        mode: 'compositor'
      },
      global: { plugins: [i18n], stubs }
    })
    expect(owner.changeCount).toBe(1)

    activate(createTracker())
    unmount()

    expect(mockAssert).not.toHaveBeenCalled()
    expect(owner.changeCount).toBe(0)
  })
})
