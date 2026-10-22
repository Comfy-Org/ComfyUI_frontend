import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect } from 'storybook/test'
import { ref } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import EnhancePromptButton from '@/workbench/extensions/agent/components/EnhancePromptButton.vue'
import * as enhancePromptRequestModule from '@/workbench/extensions/agent/services/enhancePromptRequest'
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
      const value = ref(prompt)
      const widget = promptWidget()
      return { value, widget }
    },
    template:
      '<div class="h-40 w-80"><WidgetTextarea :widget="widget" v-model="value" node-type="CLIPTextEncode" /></div>'
  })
}

function hangEnhancePromptRequest() {
  const original = enhancePromptRequestModule.enhancePromptRequest
  Reflect.set(
    enhancePromptRequestModule,
    'enhancePromptRequest',
    () => new Promise(() => {})
  )
  return () => {
    Reflect.set(enhancePromptRequestModule, 'enhancePromptRequest', original)
  }
}

export const InPromptBox: Story = {
  beforeEach() {
    useAgentPanelStore().enabled = true
  },
  render: renderPromptBox(SAMPLE_PROMPT)
}

export const InPromptBoxProcessing: Story = {
  beforeEach() {
    useAgentPanelStore().enabled = true
    return hangEnhancePromptRequest()
  },
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
  beforeEach() {
    useAgentPanelStore().enabled = true
  },
  render: renderPromptBox(ENHANCED_PROMPT)
}
