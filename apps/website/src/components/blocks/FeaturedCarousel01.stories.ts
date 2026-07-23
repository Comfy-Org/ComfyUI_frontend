import type { Meta, StoryObj } from '@storybook/vue3-vite'

import FeaturedCarousel01 from './FeaturedCarousel01.vue'

const sampleImage =
  'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&q=80'

const meta: Meta<typeof FeaturedCarousel01> = {
  title: 'Website/Blocks/FeaturedCarousel01',
  component: FeaturedCarousel01,
  tags: ['autodocs'],
  args: {
    slides: [
      {
        id: 'a',
        media: { type: 'image', src: sampleImage, alt: 'Featured event' },
        eyebrow: 'UPCOMING LIVESTREAM',
        title: 'LTX x Comfy: Open world models in production',
        href: '#'
      },
      {
        id: 'b',
        media: { type: 'image', src: sampleImage, alt: 'Second event' },
        eyebrow: 'UPCOMING LIVESTREAM',
        title: 'Comfy MCP: Live demo & Q&A',
        href: '#'
      }
    ],
    prevLabel: 'Previous featured event',
    nextLabel: 'Next featured event'
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const SingleSlide: Story = {
  args: {
    slides: [
      {
        id: 'a',
        media: { type: 'image', src: sampleImage, alt: 'Featured event' },
        eyebrow: 'UPCOMING LIVESTREAM',
        title: 'LTX x Comfy: Open world models in production'
      }
    ]
  }
}

export const TitleHidden: Story = {
  args: {
    slides: [
      {
        id: 'a',
        media: { type: 'image', src: sampleImage, alt: 'Featured event' },
        eyebrow: 'UPCOMING LIVESTREAM',
        title: 'LTX x Comfy: Open world models in production',
        showTitle: false
      },
      {
        id: 'b',
        media: { type: 'image', src: sampleImage, alt: 'Second event' },
        eyebrow: 'UPCOMING LIVESTREAM',
        title: 'Comfy MCP: Live demo & Q&A'
      }
    ]
  }
}
