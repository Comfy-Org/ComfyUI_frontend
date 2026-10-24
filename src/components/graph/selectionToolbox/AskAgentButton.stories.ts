import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { fromPartial } from '@total-typescript/shoehorn'
import { expect, within } from 'storybook/test'
import { onMounted, useTemplateRef } from 'vue'

import NodeContextMenu from '@/components/graph/NodeContextMenu.vue'
import SelectionToolbox from '@/components/graph/SelectionToolbox.vue'
import { useSelectionStore } from '@/core/selection/selectionStore'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { selectableKeyOf } from '@/renderer/core/canvas/litegraph/selectionAdapter'
import { graphScopeOf } from '@/types/graphScopeId'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import AskAgentButton from './AskAgentButton.vue'

function prepareAskAgentToolbox() {
  const graph = new LGraph()
  const node = new LGraphNode('KSampler')
  node.pos = [240, 180]
  graph.add(node)

  const canvasEl = document.createElement('canvas')
  canvasEl.className = 'absolute inset-0 size-full'
  const canvasStore = useCanvasStore()
  canvasStore.canvas = fromPartial<LGraphCanvas>({
    canvas: canvasEl,
    graph,
    ds: { scale: 1, offset: [0, 0] },
    isDragging: false,
    selectedItems: new Set([node]),
    getNodeMenuOptions: () => [],
    read_only: false,
    setDirty: () => {}
  })
  useSelectionStore().apply(graphScopeOf(graph), {
    type: 'selection.add',
    key: selectableKeyOf(node)
  })
  useAgentPanelStore().enabled = true
  return { canvasEl }
}

const meta: Meta<typeof AskAgentButton> = {
  title: 'Graph/SelectionToolbox/AskAgent',
  component: AskAgentButton,
  tags: ['autodocs'],
  parameters: { layout: 'padded' }
}

export default meta
type Story = StoryObj<typeof meta>

export const Toolbar: Story = {
  render: () => ({
    components: { SelectionToolbox, NodeContextMenu },
    setup() {
      const host = useTemplateRef<HTMLElement>('host')
      const { canvasEl } = prepareAskAgentToolbox()
      onMounted(() => {
        host.value?.prepend(canvasEl)
      })
      return {}
    },
    template: `
      <div
        ref="host"
        class="relative min-h-96 w-[40rem] bg-background"
      >
        <SelectionToolbox />
        <NodeContextMenu />
      </div>
    `
  })
}

export const MoreMenu: Story = {
  ...Toolbar,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument
    const button = doc.querySelector('[data-testid="more-options-button"]')
    if (!(button instanceof HTMLElement)) {
      throw new Error('more-options-button is missing')
    }
    const rect = button.getBoundingClientRect()
    button.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        detail: 1,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
        view: doc.defaultView ?? window
      })
    )
    const page = within(doc.body)
    await expect(page.getByRole('menu')).toBeVisible()
    await expect(
      page.getByRole('menuitem', { name: /Reference in agent/i })
    ).toBeVisible()
  }
}
