import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect } from 'storybook/test'
import { ref } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import EnhancePromptButton from '@/workbench/extensions/agent/components/EnhancePromptButton.vue'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import WidgetTextarea from './WidgetTextarea.vue'

const SAMPLE_PROMPT =
  'Cinematic drone perspective shot, smooth camera movement: drone flies forward from behind the character, then rotates 180 degrees to look back at the character, then slowly pushes up and ascends.'

const ENHANCED_PROMPT =
  'Cinematic drone perspective shot, smooth camera movement: drone flies forward from behind the character, then rotates 180 degrees to look back at the character, then slowly pushes up and ascends — enhanced with richer lighting, camera language, and material detail.'

const meta: Meta<typeof EnhancePromptButton> = {
  title: 'Agent/EnhancePromptButton',
  component: EnhancePromptButton,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered'
  }
}

export default meta
type Story = StoryObj<typeof meta>

function promptWidget(): SimplifiedWidget<string> {
  return {
    name: 'prompt',
    type: 'STRING',
    value: '',
    label: 'prompt'
  }
}

function renderPromptBox(prompt: string): Story['render'] {
  return () => ({
    components: { WidgetTextarea },
    setup() {
      useAgentPanelStore().enabled = true
      const value = ref(prompt)
      const widget = promptWidget()
      return { value, widget }
    },
    template:
      '<div class="h-40 w-80"><WidgetTextarea :widget="widget" v-model="value" node-type="CLIPTextEncode" /></div>'
  })
}

export const InPromptBox: Story = {
  render: renderPromptBox(SAMPLE_PROMPT)
}

export const InPromptBoxHover: Story = {
  render: renderPromptBox(SAMPLE_PROMPT),
  play: async ({ canvas, userEvent }) => {
    await userEvent.hover(
      canvas.getByRole('button', { name: 'Enhance prompt' })
    )
    await expect(await canvas.findByTestId('tooltip-text')).toHaveTextContent(
      'Enhance prompt'
    )
  }
}

export const InPromptBoxProcessing: Story = {
  render: renderPromptBox(SAMPLE_PROMPT),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: 'Enhance prompt' })
    )
    await expect(canvas.getByRole('textbox')).toHaveClass('agent-shimmer-text')
    await expect(canvas.getByRole('textbox')).toHaveAttribute('readonly')
  }
}

export const InPromptBoxEnhanced: Story = {
  render: renderPromptBox(ENHANCED_PROMPT)
}

export const InPromptBoxReveal: Story = {
  render: renderPromptBox(SAMPLE_PROMPT),
  play: async ({ canvas, userEvent }) => {
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
