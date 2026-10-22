import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { fn } from 'storybook/test'
import { computed, ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import Textarea from '@/components/ui/textarea/Textarea.vue'
import { cn } from '@comfyorg/tailwind-utils'

import EnhancePromptButton from './EnhancePromptButton.vue'

const SAMPLE_PROMPT =
  'Cinematic drone perspective shot, smooth camera movement: drone flies forward from behind the character, then rotates 180 degrees to look back at the character, then slowly pushes up and ascends.'

const ENHANCED_PROMPT =
  'Cinematic drone perspective shot, smooth camera movement: drone flies forward from behind the character, then rotates 180 degrees to look back at the character, then slowly pushes up and ascends — enhanced with richer lighting, camera language, and material detail.'

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

function renderPromptBox(state: 'idle' | 'processing' | 'enhanced'): Story {
  return {
    render: (args) => ({
      components: { EnhancePromptButton, Textarea },
      setup() {
        const value = ref(
          state === 'enhanced' ? ENHANCED_PROMPT : SAMPLE_PROMPT
        )
        const processing = state === 'processing'
        const textareaClass = computed(() =>
          cn(
            'size-full min-h-40 resize-none pt-5 font-mono text-(length:--comfy-textarea-font-size) leading-normal',
            processing && 'text-transparent caret-transparent'
          )
        )
        return { args, value, processing, textareaClass }
      },
      template: `
        <div
          class="relative w-80 rounded-lg bg-input p-0 text-foreground"
        >
          <label
            class="pointer-events-none absolute top-1.5 left-3 z-10 text-2xs text-muted-foreground"
          >
            prompt
          </label>
          <Textarea
            v-model="value"
            :readonly="processing"
            :class="textareaClass"
          />
          <p
            v-if="processing"
            aria-hidden="true"
            class="agent-shimmer-text pointer-events-none absolute inset-0 overflow-hidden px-3 pt-5 font-mono text-(length:--comfy-textarea-font-size) leading-normal whitespace-pre-wrap"
          >
            {{ value }}
          </p>
          <EnhancePromptButton
            class="absolute top-1.5 right-1.5 z-10"
            :loading="processing"
            :disabled="processing"
            @click="args.onClick"
          />
        </div>
      `
    })
  }
}

export const InPromptBox: Story = renderPromptBox('idle')

export const InPromptBoxProcessing: Story = renderPromptBox('processing')

export const InPromptBoxEnhanced: Story = renderPromptBox('enhanced')

function renderPropertiesPanel(
  state: 'idle' | 'processing' | 'enhanced'
): Story {
  return {
    render: (args) => ({
      components: { EnhancePromptButton, Textarea, Button },
      setup() {
        const value = ref(
          state === 'enhanced' ? ENHANCED_PROMPT : SAMPLE_PROMPT
        )
        const processing = state === 'processing'
        const textareaClass = computed(() =>
          cn(
            'size-full min-h-36 resize-none font-mono text-(length:--comfy-textarea-font-size) leading-normal',
            processing && 'text-transparent caret-transparent'
          )
        )
        return { args, value, processing, textareaClass }
      },
      template: `
        <div class="w-80 rounded-lg bg-background p-4 text-foreground">
          <div class="mb-1.5 flex min-h-8 items-center justify-between gap-1">
            <span class="truncate text-sm/8">prompt</span>
            <div class="flex shrink-0 items-center gap-1">
              <EnhancePromptButton
                tooltip-side="bottom"
                :loading="processing"
                :disabled="processing"
                @click="args.onClick"
              />
              <Button
                size="icon"
                variant="muted-textonly"
                icon="icon-[lucide--more-vertical]"
              />
            </div>
          </div>
          <div class="relative">
            <Textarea
              v-model="value"
              :readonly="processing"
              :class="textareaClass"
            />
            <p
              v-if="processing"
              aria-hidden="true"
              class="agent-shimmer-text pointer-events-none absolute inset-0 overflow-hidden px-3 py-2 font-mono text-(length:--comfy-textarea-font-size) leading-normal whitespace-pre-wrap"
            >
              {{ value }}
            </p>
          </div>
        </div>
      `
    })
  }
}

export const InPropertiesPanel: Story = renderPropertiesPanel('idle')

export const InPropertiesPanelProcessing: Story =
  renderPropertiesPanel('processing')

export const InPropertiesPanelEnhanced: Story =
  renderPropertiesPanel('enhanced')
