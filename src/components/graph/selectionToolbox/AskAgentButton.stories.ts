import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { fromPartial } from '@total-typescript/shoehorn'
import { expect, within } from 'storybook/test'
import { onMounted, useTemplateRef } from 'vue'

import NodeContextMenu from '@/components/graph/NodeContextMenu.vue'
import SelectionToolbox from '@/components/graph/SelectionToolbox.vue'
import { useSelectionStore } from '@/core/selection/selectionStore'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import {
  ASK_AGENT_TOOLBAR_SEEN_SETTING_ID,
  REFERENCE_IN_AGENT_MENU_SEEN_SETTING_ID
} from '@/platform/settings/constants/agent'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { selectableKeyOf } from '@/renderer/core/canvas/litegraph/selectionAdapter'
import { graphScopeOf } from '@/types/graphScopeId'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import AskAgentButton from './AskAgentButton.vue'

function prepareAskAgentToolbox(seen?: { toolbar?: boolean; menu?: boolean }) {
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
  useSettingStore().settingValues[ASK_AGENT_TOOLBAR_SEEN_SETTING_ID] =
    seen?.toolbar ?? false
  useSettingStore().settingValues[REFERENCE_IN_AGENT_MENU_SEEN_SETTING_ID] =
    seen?.menu ?? false
  return { canvasEl }
}

function renderToolbox(seen?: { toolbar?: boolean; menu?: boolean }) {
  return {
    components: { SelectionToolbox, NodeContextMenu },
    setup() {
      const host = useTemplateRef<HTMLElement>('host')
      const { canvasEl } = prepareAskAgentToolbox(seen)
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
  }
}

async function openMoreMenu(canvasElement: HTMLElement) {
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
  return within(doc.body)
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
  render: () => renderToolbox()
}

export const ToolbarNewDot: Story = {
  render: () => renderToolbox({ toolbar: false })
}

export const ToolbarSeen: Story = {
  render: () => renderToolbox({ toolbar: true })
}

export const MoreMenu: Story = {
  ...Toolbar,
  play: async ({ canvasElement }) => {
    const page = await openMoreMenu(canvasElement)
    await expect(page.getByRole('menu')).toBeVisible()
    await expect(
      page.getByRole('menuitem', { name: /Reference in agent/i })
    ).toBeVisible()
  }
}

export const MoreMenuNewPill: Story = {
  render: () => renderToolbox({ menu: false }),
  play: async ({ canvasElement }) => {
    const page = await openMoreMenu(canvasElement)
    await expect(page.getByRole('menu')).toBeVisible()
    await expect(
      page.getByRole('menuitem', { name: /Reference in agent/i })
    ).toHaveTextContent('NEW')
  }
}

export const MoreMenuSeen: Story = {
  render: () => renderToolbox({ menu: true }),
  play: async ({ canvasElement }) => {
    const page = await openMoreMenu(canvasElement)
    await expect(page.getByRole('menu')).toBeVisible()
    const item = page.getByRole('menuitem', { name: /Reference in agent/i })
    await expect(item).toBeVisible()
    await expect(item).not.toHaveTextContent('NEW')
  }
}
