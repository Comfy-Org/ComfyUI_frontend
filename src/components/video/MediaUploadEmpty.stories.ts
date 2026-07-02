import type {
  ComponentPropsAndSlots,
  Meta,
  StoryObj
} from '@storybook/vue3-vite'
import { ref } from 'vue'

import MediaUploadEmpty from './MediaUploadEmpty.vue'

type StoryArgs = ComponentPropsAndSlots<typeof MediaUploadEmpty>

const meta: Meta<StoryArgs> = {
  title: 'Components/Video/MediaUploadEmpty',
  component: MediaUploadEmpty,
  tags: ['autodocs'],
  decorators: [
    () => ({
      template:
        '<div class="w-[350px] rounded-2xl bg-node-component-surface p-2"><story /></div>'
    })
  ],
  args: {
    accept: 'video/*',
    disabled: false,
    uploading: false
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => ({
    components: { MediaUploadEmpty },
    setup() {
      const uploading = ref(false)
      function handleBrowse() {
        uploading.value = true
        setTimeout(() => {
          uploading.value = false
        }, 1200)
      }
      return { args, uploading, handleBrowse }
    },
    template: `
      <MediaUploadEmpty
        v-bind="args"
        :uploading="uploading"
        @browse="handleBrowse"
      />
    `
  })
}

export const Uploading: Story = {
  args: {
    uploading: true
  }
}

export const Disabled: Story = {
  args: {
    disabled: true
  }
}

export const Hovered: Story = {
  render: (args) => ({
    components: { MediaUploadEmpty },
    setup() {
      return { args }
    },
    template: `
      <MediaUploadEmpty
        v-bind="args"
        class="border-component-node-foreground-secondary bg-component-node-widget-background-hovered"
      />
    `
  })
}
