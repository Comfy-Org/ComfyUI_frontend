import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { computed, defineComponent, h, ref } from 'vue'

import TooltipProvider from '@comfyorg/design-system/tooltip/TooltipProvider'
import { toNodeId } from '@comfyorg/graph-model/nodeId'
import { LGraph, LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import type { WidgetGridItem } from '@/renderer/extensions/vueNodes/types/widgetGrid'
import WidgetInputText from '@/renderer/extensions/vueNodes/widgets/components/WidgetInputText.vue'
import { createMockLoadedWorkflow } from '@/utils/__tests__/litegraphTestUtils'
import { testI18n } from '@/utils/__tests__/testI18n'
import { stubCanvasGetContext } from '@/utils/__tests__/canvasTestUtils'

import WidgetGrid from './WidgetGrid.vue'

vi.mock(import('@/scripts/app'))

function editor() {
  stubCanvasGetContext()
  onTestFinished(() =>
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockRestore()
  )
  const root = new LGraph()
  const node = new LGraphNode('Test')
  node.id = toNodeId(17)
  node.addInput('value', 'STRING')
  root.add(node)
  useCanvasStore().canvas = new LGraphCanvas(
    document.createElement('canvas'),
    root,
    {
      skip_render: true,
      skip_events: true
    }
  )
  useCanvasStore().currentGraph = root
  const value = ref('')
  const nodeMenu = vi.fn()
  const captures: string[] = []
  const workflow = createMockLoadedWorkflow()
  vi.spyOn(workflow.changeTracker, 'captureCanvasState').mockImplementation(
    () => {
      captures.push(value.value)
    }
  )
  useWorkflowStore().activeWorkflow = workflow
  const items = computed<WidgetGridItem[]>(() => [
    {
      renderKey: 'value',
      simplified: { name: 'value', type: 'string', value: value.value },
      visible: true,
      slotMetadata: {
        index: 0,
        linked: false,
        promoted: false,
        type: 'STRING'
      },
      vueComponent: WidgetInputText,
      handleContextMenu: nodeMenu,
      updateHandler: (next) => {
        value.value = String(next)
      }
    }
  ])
  const Probe = defineComponent({
    setup() {
      return () =>
        h(
          TooltipProvider,
          {},
          {
            default: () => [
              h(WidgetGrid, {
                processedWidgets: items.value,
                nodeId: toNodeId(17),
                nodeType: 'Test',
                presentation: 'form'
              }),
              h('button', {}, 'Leave field')
            ]
          }
        )
    }
  })
  render(Probe, { global: { plugins: [testI18n] } })
  return { value, captures, nodeMenu }
}

describe('shared widget form presentation', () => {
  it('records one committed text edit when focus leaves the field', async () => {
    const { value, captures } = editor()
    const user = userEvent.setup()

    await user.type(screen.getByRole('textbox', { name: 'value' }), 'complete')
    expect(value.value).toBe('complete')
    expect(captures).toEqual([])
    await user.click(screen.getByRole('button', { name: 'Leave field' }))

    expect(captures).toEqual(['complete'])
  })

  it('omits graph sockets and graph menus while retaining the native field', async () => {
    const { nodeMenu } = editor()

    await userEvent.pointer({
      keys: '[MouseRight]',
      target: screen.getByRole('textbox', { name: 'value' })
    })

    expect(screen.queryByTestId('slot-dot')).not.toBeInTheDocument()
    expect(nodeMenu).not.toHaveBeenCalled()
  })

  it.for([
    {
      name: 'read only',
      activate: () => {
        useCanvasStore().getCanvas().read_only = true
      }
    },
    {
      name: 'node picking',
      activate: () => {
        useCanvasStore().isPickingNodes = true
      }
    }
  ])(
    'makes the shared editor inert while $name is active',
    async ({ activate }) => {
      editor()
      activate()
      await userEvent.tab()

      expect(screen.getByTestId('node-widgets')).toHaveAttribute('inert')
    }
  )
})
