import type { Meta, StoryObj } from '@storybook/vue3-vite'

import CardWorkflowGallery01 from './CardWorkflowGallery01.vue'

const items = [
  {
    id: 'product-advertisement-video',
    title: 'Product Advertisement Video',
    media: {
      type: 'video' as const,
      src: 'https://comfy-hub-assets.comfy.org/uploads/a8c26beb-d463-40a0-8547-fa942e53ad70.mp4',
      alt: 'Product Advertisement Video'
    },
    tags: ['Advertising']
  },
  {
    id: 'storyboard-to-video-seedance',
    title: 'Storyboard To Video - Seedance 2.0',
    media: {
      type: 'video' as const,
      src: 'https://comfy-hub-assets.comfy.org/uploads/34ea9f1a-1aac-4c6f-af48-b88cf154ec9b.mp4',
      alt: 'Storyboard To Video - Seedance 2.0'
    },
    tags: ['Advertising', 'Film']
  },
  {
    id: 'headphones-still',
    title: 'Product Still Workflow',
    media: {
      type: 'image' as const,
      src: 'https://media.comfy.org/website/fdct/headphones.png',
      alt: 'Product Still Workflow'
    },
    tags: ['Ecommerce']
  }
]

const meta: Meta<typeof CardWorkflowGallery01> = {
  title: 'Website/Blocks/CardWorkflowGallery01',
  component: CardWorkflowGallery01,
  tags: ['autodocs'],
  args: {
    title: 'Featured projects',
    titleAlign: 'center',
    items
  },
  decorators: [
    () => ({
      template: '<div class="bg-primary-comfy-ink"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const NoTitle: Story = {
  args: { title: undefined }
}

export const LinkedCards: Story = {
  args: {
    items: items.map((item) => ({
      ...item,
      href: 'https://comfy.org/workflows/c98e5c457e1e-c98e5c457e1e/'
    }))
  }
}
