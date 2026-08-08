import type { Meta, StoryObj } from '@storybook/vue3-vite'

import CardWorkflow01 from './CardWorkflow01.vue'

const meta: Meta<typeof CardWorkflow01> = {
  title: 'Website/Blocks/CardWorkflow01',
  component: CardWorkflow01,
  tags: ['autodocs'],
  args: {
    tryNowLabel: 'Try now',
    item: {
      id: 'product-advertisement-video',
      title: 'Product Advertisement Video',
      href: 'https://comfy.org/workflows/c98e5c457e1e-c98e5c457e1e/',
      media: {
        type: 'video',
        src: 'https://comfy-hub-assets.comfy.org/uploads/a8c26beb-d463-40a0-8547-fa942e53ad70.mp4',
        alt: 'Product Advertisement Video'
      },
      creator: {
        name: 'Rob Losch',
        avatarSrc:
          'https://media.comfy.org/website/technologists/rob-losch.png',
        href: 'https://comfy.org/workflows/hellorob/'
      },
      tags: ['Image Generation', 'Image to Video']
    }
  },
  decorators: [
    () => ({
      template: '<div class="max-w-sm bg-primary-comfy-ink p-6"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const NoTags: Story = {
  args: {
    item: {
      id: 'ltx-cleanplate-for-vfx',
      title: 'LTX Cleanplate for VFX',
      href: 'https://comfy.org/workflows/8f2cf0df5da6-8f2cf0df5da6/',
      media: {
        type: 'video',
        src: 'https://comfy-hub-assets.comfy.org/uploads/8a3a846f-5017-428e-b2a2-24025c55e884.mp4',
        alt: 'LTX Cleanplate for VFX'
      },
      creator: {
        name: 'Doug Hogan',
        avatarSrc:
          'https://media.comfy.org/website/technologists/doug-hogan.png',
        href: 'https://comfy.org/workflows/doughogan/'
      }
    }
  }
}
