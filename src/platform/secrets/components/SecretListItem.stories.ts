import type { Meta, StoryObj } from '@storybook/vue3-vite'

import type { SecretMetadata } from '../types'
import SecretListItem from './SecretListItem.vue'

const sampleSecret: SecretMetadata = {
  id: 'secret-huggingface',
  name: 'HuggingFace API Key',
  provider: 'huggingface',
  created_at: '2026-02-06T10:00:00Z',
  updated_at: '2026-02-06T10:00:00Z',
  last_used_at: '2026-04-17T10:00:00Z'
}

const meta: Meta<typeof SecretListItem> = {
  title: 'Platform/Secrets/SecretListItem',
  component: SecretListItem,
  parameters: {
    layout: 'centered'
  },
  decorators: [
    () => ({
      template: `
        <div class="w-[480px] bg-base-background p-8">
          <story />
        </div>
      `
    })
  ],
  args: {
    secret: sampleSecret,
    loading: false,
    disabled: false
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const NeverUsed: Story = {
  args: {
    secret: {
      ...sampleSecret,
      id: 'secret-civitai',
      name: 'Civitai Token',
      provider: 'civitai',
      last_used_at: undefined
    }
  }
}

export const Loading: Story = {
  args: {
    loading: true
  }
}

export const Disabled: Story = {
  args: {
    disabled: true
  }
}
