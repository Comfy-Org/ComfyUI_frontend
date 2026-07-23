import type { Meta, StoryObj } from '@storybook/vue3-vite'

import Attachment from './Attachment.vue'
import AttachmentAction from './AttachmentAction.vue'
import AttachmentActions from './AttachmentActions.vue'
import AttachmentContent from './AttachmentContent.vue'
import AttachmentMedia from './AttachmentMedia.vue'
import AttachmentTitle from './AttachmentTitle.vue'

const meta: Meta<typeof Attachment> = {
  title: 'Components/Attachment',
  component: Attachment,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['default', 'sm', 'xs']
    }
  },
  args: {
    size: 'default'
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => ({
    components: { Attachment, AttachmentContent, AttachmentTitle },
    setup() {
      return { args }
    },
    template: `
      <Attachment v-bind="args">
        <AttachmentContent>
          <AttachmentTitle>message-renderer.vue</AttachmentTitle>
        </AttachmentContent>
      </Attachment>
    `
  })
}

export const WithIcon: Story = {
  render: (args) => ({
    components: {
      Attachment,
      AttachmentMedia,
      AttachmentContent,
      AttachmentTitle
    },
    setup() {
      return { args }
    },
    template: `
      <Attachment v-bind="args">
        <AttachmentMedia>
          <i class="icon-[comfy--node] size-3.5" />
        </AttachmentMedia>
        <AttachmentContent>
          <AttachmentTitle>CLIP Text Encode (Prompt)</AttachmentTitle>
        </AttachmentContent>
      </Attachment>
    `
  })
}

export const Removable: Story = {
  render: (args) => ({
    components: {
      Attachment,
      AttachmentMedia,
      AttachmentContent,
      AttachmentTitle,
      AttachmentActions,
      AttachmentAction
    },
    setup() {
      return { args }
    },
    template: `
      <Attachment v-bind="args">
        <AttachmentMedia>
          <i class="icon-[comfy--node] size-3.5" />
        </AttachmentMedia>
        <AttachmentContent>
          <AttachmentTitle>ModelSamplingAuraFlow</AttachmentTitle>
        </AttachmentContent>
        <AttachmentActions>
          <AttachmentAction aria-label="Remove">
            <i class="icon-[lucide--x]" />
          </AttachmentAction>
        </AttachmentActions>
      </Attachment>
    `
  })
}

export const Sizes: Story = {
  render: () => ({
    components: {
      Attachment,
      AttachmentMedia,
      AttachmentContent,
      AttachmentTitle,
      AttachmentActions,
      AttachmentAction
    },
    template: `
      <div class="flex flex-col items-start gap-4">
        <Attachment v-for="size in ['default', 'sm', 'xs']" :key="size" :size="size">
          <AttachmentMedia>
            <i class="icon-[comfy--node] size-3.5" />
          </AttachmentMedia>
          <AttachmentContent>
            <AttachmentTitle>VAE Decode</AttachmentTitle>
          </AttachmentContent>
          <AttachmentActions>
            <AttachmentAction aria-label="Remove">
              <i class="icon-[lucide--x]" />
            </AttachmentAction>
          </AttachmentActions>
        </Attachment>
      </div>
    `
  })
}
