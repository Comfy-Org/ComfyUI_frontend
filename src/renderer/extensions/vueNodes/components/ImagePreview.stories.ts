import type { Meta, StoryObj } from '@storybook/vue3-vite'

import ImagePreview from './ImagePreview.vue'

const SAMPLE_URLS = [
  'https://picsum.photos/seed/preview1/800/600',
  'https://picsum.photos/seed/preview2/800/600',
  'https://picsum.photos/seed/preview3/800/600'
]

const meta: Meta<typeof ImagePreview> = {
  title: 'Components/Display/ImagePreview',
  component: ImagePreview,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Node output image preview with navigation dots, keyboard controls, and hover action buttons (download, remove, edit/mask).'
      }
    }
  },
  decorators: [
    (story) => ({
      components: { story },
      template:
        '<div class="h-80 w-96 rounded-lg bg-component-node-background"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    imageUrls: [SAMPLE_URLS[0]]
  }
}

export const MultipleImages: Story = {
  args: {
    imageUrls: SAMPLE_URLS
  }
}

export const ErrorState: Story = {
  args: {
    imageUrls: ['https://invalid.example.com/no-image.png']
  }
}

export const ManyImages: Story = {
  args: {
    imageUrls: Array.from(
      { length: 8 },
      (_, i) => `https://picsum.photos/seed/many${i}/800/600`
    )
  }
}
