import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'
import { provide } from 'vue'

import { t } from '@/i18n'
import NodeAskAgentHover from '@/components/graph/NodeAskAgentHover.vue'
import { nodeAskAgentHoverAlwaysVisibleKey } from '@/components/graph/nodeAskAgentHoverAlwaysVisible'
import { LGraph, LGraphEventMode, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import LGraphNodeVue from '@/renderer/extensions/vueNodes/components/LGraphNode.vue'
import { toNodeId } from '@/types/nodeId'
import type { NodeState } from '@/types/nodeState'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

class PartnerAskNode extends LGraphNode {
  static override nodeData = {
    name: 'ByteDanceSeedance',
    api_node: true
  }
}

function seedHoverNode(options: { title: string; partner?: boolean }) {
  const graph = new LGraph()
  const node = options.partner
    ? new PartnerAskNode(options.title)
    : new LGraphNode(options.title)
  node.id = toNodeId(12)
  node.pos = [32, 48]
  graph.add(node)
  useCanvasStore().currentGraph = graph
  useAgentPanelStore().enabled = true
  const nodeState: NodeState = {
    flags: {},
    graphId: graph.id,
    id: node.id,
    inputs: [],
    mode: LGraphEventMode.ALWAYS,
    outputs: [],
    title: node.title,
    type: node.type,
    properties: {}
  }
  return nodeState
}

function pageOf(canvasElement: HTMLElement) {
  return within(canvasElement.ownerDocument.body)
}

const meta: Meta<typeof NodeAskAgentHover> = {
  title: 'Graph/NodeAskAgentHover',
  component: NodeAskAgentHover,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  args: {
    nodeId: toNodeId(12)
  },
  render: (_args, { args }) => ({
    components: { LGraphNodeVue },
    setup() {
      provide(nodeAskAgentHoverAlwaysVisibleKey, true)
      const nodeState = seedHoverNode({
        title: args.isPartner
          ? 'ByteDance Seedance 2.5 First-Last-Frame to Video'
          : 'ModelSamplingAuraFlow',
        partner: args.isPartner
      })
      return { nodeState }
    },
    template: `
      <div class="relative min-h-96 w-3xl overflow-visible bg-background p-16">
        <LGraphNodeVue :node-data="nodeState" />
      </div>
    `
  })
}

export default meta
type Story = StoryObj<typeof meta>

export const FloatingButton: Story = {}

export const ButtonHover: Story = {
  play: async ({ canvasElement }) => {
    const page = pageOf(canvasElement)
    await userEvent.hover(
      page.getByRole('button', { name: t('agent.askAgent') })
    )
  }
}

export const ComposerOpen: Story = {
  play: async ({ canvasElement }) => {
    const page = pageOf(canvasElement)
    await userEvent.click(
      page.getByRole('button', { name: t('agent.askAgent') })
    )
    await expect(
      page.getByRole('textbox', { name: t('agent.nodeHover.placeholder') })
    ).toHaveFocus()
  }
}

export const PartnerComposerOpen: Story = {
  args: { isPartner: true },
  play: async ({ canvasElement }) => {
    const page = pageOf(canvasElement)
    await userEvent.click(
      page.getByRole('button', { name: t('agent.askAgent') })
    )
    await expect(
      page.getByRole('button', { name: t('agent.nodeHover.enhance') })
    ).toBeVisible()
  }
}
