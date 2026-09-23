import type { Meta, StoryObj } from '@storybook/vue3-vite'

import '../../../agentPanel.css'

import AttachmentChip from './AttachmentChip.vue'

const meta: Meta<typeof AttachmentChip> = {
  title: 'Agent/Composer/AttachmentChip',
  component: AttachmentChip,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  decorators: [
    () => ({
      template:
        '<div class="agent-scope flex max-w-64 flex-wrap gap-2 bg-secondary-background p-4"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { name: 'reference.png' }
}

export const ImagePreview: Story = {
  args: {
    name: 'reference.png',
    previewUrl: '/assets/images/default-template.png'
  }
}

export const LongName: Story = {
  args: {
    name: 'an-extremely-long-reference-image-filename-that-must-truncate-in-the-prompt.png'
  }
}

export const Uploading: Story = {
  args: {
    name: 'an-extremely-long-uploading-reference-image-filename.png',
    uploading: true
  }
}
