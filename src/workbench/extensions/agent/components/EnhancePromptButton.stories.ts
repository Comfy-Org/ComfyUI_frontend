import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { expect, fn } from 'storybook/test'
import { provide, reactive } from 'vue'

import WidgetItem from '@/components/rightSidePanel/parameters/WidgetItem.vue'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { registerApp } from '@/scripts/appRegistry'
import type { ComfyApp } from '@/types/comfy'
import { toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'
import { HideLayoutFieldKey } from '@/types/widgetTypes'
import type { WidgetValue } from '@/utils/widgetUtil'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import EnhancePromptButton from './EnhancePromptButton.vue'

const SAMPLE_PROMPT =
  'Cinematic drone perspective shot, smooth camera movement: drone flies forward from behind the character, then rotates 180 degrees to look back at the character, then slowly pushes up and ascends.'

const ENHANCED_PROMPT =
  'Cinematic drone perspective shot, smooth camera movement: drone flies forward from behind the character, then rotates 180 degrees to look back at the character, then slowly pushes up and ascends — enhanced with richer lighting, camera language, and material detail.'

const GRAPH_ID = 'story-graph'
const NODE_ID = toNodeId(1)

function registerStoryApp() {
  registerApp(
    fromPartial<ComfyApp>({
      rootGraphOrUndefined: undefined
    })
  )
}

function storyNode(): LGraphNode {
  return fromAny<LGraphNode, unknown>({
    id: NODE_ID,
    type: 'CLIPTextEncode',
    title: 'CLIP Text Encode (Prompt)',
    isSubgraphNode: () => false,
    graph: { id: GRAPH_ID, rootGraph: { id: GRAPH_ID } },
    inputs: []
  })
}

function storyWidget(value: string): IBaseWidget {
  return reactive({
    name: 'prompt',
    type: 'customtext',
    value,
    y: 0,
    widgetId: widgetId(GRAPH_ID, NODE_ID, 'prompt'),
    options: {}
  })
}

function renderPropertiesPanel(prompt: string): Story['render'] {
  return () => ({
    components: { WidgetItem },
    setup() {
      registerStoryApp()
      useAgentPanelStore().enabled = true
      provide(HideLayoutFieldKey, true)
      const widget = storyWidget(prompt)
      const node = storyNode()
      function onUpdate(value: WidgetValue) {
        widget.value = value
      }
      return { widget, node, onUpdate }
    },
    template: `
      <div class="w-80 rounded-lg bg-background p-4 text-foreground">
        <WidgetItem
          :widget="widget"
          :node="node"
          @update:widget-value="onUpdate"
        />
      </div>
    `
  })
}

const meta: Meta<typeof EnhancePromptButton> = {
  title: 'Agent/EnhancePromptButton',
  component: EnhancePromptButton,
  tags: ['autodocs'],
  args: {
    loading: false,
    disabled: false,
    onClick: fn()
  },
  argTypes: {
    loading: { control: 'boolean' },
    disabled: { control: 'boolean' }
  },
  parameters: {
    layout: 'centered'
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Processing: Story = {
  args: {
    loading: true,
    disabled: true
  }
}

export const InPropertiesPanel: Story = {
  render: renderPropertiesPanel(SAMPLE_PROMPT)
}

export const InPropertiesPanelProcessing: Story = {
  render: renderPropertiesPanel(SAMPLE_PROMPT),
  play: async ({ canvas, userEvent }) => {
    await canvas.findByRole('textbox')
    await userEvent.click(
      canvas.getByRole('button', { name: 'Enhance prompt' })
    )
    await expect(canvas.getByRole('textbox')).toHaveClass('agent-shimmer-text')
    await expect(canvas.getByRole('textbox')).toHaveAttribute('readonly')
  }
}

export const InPropertiesPanelReveal: Story = {
  render: renderPropertiesPanel(SAMPLE_PROMPT),
  play: async ({ canvas, userEvent }) => {
    await canvas.findByRole('textbox')
    await userEvent.click(
      canvas.getByRole('button', { name: 'Enhance prompt' })
    )
    await expect(canvas.getByRole('textbox')).toHaveClass('agent-shimmer-text')
    await expect(
      await canvas.findByText('enhanced', {}, { timeout: 3000 })
    ).toHaveClass('agent-talk-word')
    await expect(canvas.getByRole('textbox')).toHaveClass('invisible')
    await expect(canvas.getByRole('textbox')).toHaveAttribute('readonly')
  }
}

export const InPropertiesPanelEnhanced: Story = {
  render: renderPropertiesPanel(ENHANCED_PROMPT)
}
