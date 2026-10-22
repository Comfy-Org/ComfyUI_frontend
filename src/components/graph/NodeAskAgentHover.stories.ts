import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'

import { t } from '@/i18n'
import NodeAskAgentHover from '@/components/graph/NodeAskAgentHover.vue'
import {
  LGraph,
  LGraphEventMode,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import NodeHeader from '@/renderer/extensions/vueNodes/components/NodeHeader.vue'
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
  return { node, nodeState }
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
    nodeId: toNodeId(12),
    alwaysVisible: true
  },
  render: (_args, { args }) => ({
    components: { NodeAskAgentHover, NodeHeader },
    setup() {
      const { node, nodeState } = seedHoverNode({
        title: args.isPartner
          ? 'ByteDance Seedance 2.5 First-Last-Frame to Video'
          : 'ModelSamplingAuraFlow',
        partner: args.isPartner
      })
      return {
        args: { ...args, nodeId: node.id },
        nodeState
      }
    },
    template: `
      <div class="relative min-h-96 w-3xl overflow-visible bg-background p-16">
        <div
          class="group/node relative w-80 bg-node-header text-node-foreground"
        >
          <NodeHeader :node-data="nodeState" />
          <NodeAskAgentHover v-bind="args" />
        </div>
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
