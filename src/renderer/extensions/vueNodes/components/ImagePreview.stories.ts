import type { Meta, StoryObj } from '@storybook/vue3-vite'

import type { AugmentedResultItem } from '@/utils/resultItem'

import ImagePreview from './ImagePreview.vue'

function sampleItem(seed: string, previewUrl?: string): AugmentedResultItem {
  return {
    filename: `${seed}.png`,
    subfolder: '',
    type: 'output',
    mediaType: 'images',
    nodeId: '1',
    previewUrl: previewUrl ?? `https://picsum.photos/seed/${seed}/800/600`
  }
}

const SAMPLE_ITEMS = ['preview1', 'preview2', 'preview3'].map((seed) =>
  sampleItem(seed)
)

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
    items: [SAMPLE_ITEMS[0]]
  }
}

export const MultipleImages: Story = {
  args: {
    items: SAMPLE_ITEMS
  }
}

export const ErrorState: Story = {
  args: {
    items: [sampleItem('no-image', 'https://invalid.example.com/no-image.png')]
  }
}

export const ManyImages: Story = {
  args: {
    items: Array.from({ length: 8 }, (_, i) => sampleItem(`many${i}`))
  }
}
