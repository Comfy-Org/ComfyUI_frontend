import type { Meta, StoryObj } from '@storybook/vue3-vite'

import ImageStack from './ImageStack.vue'

const SAMPLE_IMAGES = [
  'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=300&h=300&fit=crop',
  'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=300&h=300&fit=crop',
  'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=300&h=300&fit=crop',
  'https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=300&h=300&fit=crop'
]

const meta: Meta<typeof ImageStack> = {
  title: 'Platform/Assets/ImageStack',
  component: ImageStack,
  decorators: [
    () => ({
      template:
        '<div style="max-width: 280px; background: var(--comfy-color-base-background, #1a1a2e); padding: 16px; border-radius: 12px;"><story /></div>'
    })
  ],
  argTypes: {
    count: { control: { type: 'number', min: 1, max: 50 } },
    maxVisible: { control: { type: 'number', min: 1, max: 4 } }
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const SingleImage: Story = {
  args: {
    images: [SAMPLE_IMAGES[0]],
    count: 1
  }
}

export const TwoImages: Story = {
  args: {
    images: SAMPLE_IMAGES.slice(0, 2),
    count: 2
  }
}

export const ThreeImages: Story = {
  args: {
    images: SAMPLE_IMAGES.slice(0, 3),
    count: 3
  }
}

export const ManySelected: Story = {
  args: {
    images: SAMPLE_IMAGES.slice(0, 3),
    count: 27
  }
}

export const NoPreview: Story = {
  args: {
    images: ['', '', ''],
    count: 5
  }
}

export const MixedPreview: Story = {
  args: {
    images: [SAMPLE_IMAGES[0], '', SAMPLE_IMAGES[2]],
    count: 8
  }
}

export const AllVariants: Story = {
  render: () => ({
    components: { ImageStack },
    setup() {
      return { images: SAMPLE_IMAGES }
    },
    template: `
      <div style="display: flex; flex-wrap: wrap; gap: 32px; align-items: flex-start;">
        <div style="text-align: center;">
          <ImageStack :images="[images[0]]" :count="1" />
          <div style="margin-top: 8px; font-size: 12px; opacity: 0.6;">1 selected</div>
        </div>
        <div style="text-align: center;">
          <ImageStack :images="images.slice(0, 2)" :count="2" />
          <div style="margin-top: 8px; font-size: 12px; opacity: 0.6;">2 selected</div>
        </div>
        <div style="text-align: center;">
          <ImageStack :images="images.slice(0, 3)" :count="3" />
          <div style="margin-top: 8px; font-size: 12px; opacity: 0.6;">3 selected</div>
        </div>
        <div style="text-align: center;">
          <ImageStack :images="images.slice(0, 3)" :count="12" />
          <div style="margin-top: 8px; font-size: 12px; opacity: 0.6;">12 selected</div>
        </div>
      </div>
    `
  })
}
