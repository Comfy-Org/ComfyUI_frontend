import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'

import FeaturedCarousel01 from './FeaturedCarousel01.vue'

const sampleImage = '/images/mcp/mcp-thumb-keyart.webp'

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
        href: '#',
        autoplayMs: 3000
      },
      {
        id: 'b',
        media: { type: 'image', src: sampleImage, alt: 'Second event' },
        eyebrow: 'UPCOMING LIVESTREAM',
        title: 'Comfy MCP: Live demo & Q&A',
        href: '#',
        autoplayMs: 5000
      }
    ],
    prevLabel: 'Previous featured event',
    nextLabel: 'Next featured event'
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const firstLink = canvas.getByRole('link', {
      name: 'LTX x Comfy: Open world models in production'
    })
    const secondLink = canvasElement.querySelector(
      'a[aria-label="Comfy MCP: Live demo & Q&A"]'
    )

    await expect(firstLink.parentElement).toHaveAttribute(
      'aria-hidden',
      'false'
    )
    await userEvent.click(
      canvas.getByRole('button', { name: 'Next featured event' })
    )
    await expect(firstLink.parentElement).toHaveAttribute('aria-hidden', 'true')
    await expect(secondLink?.parentElement).toHaveAttribute(
      'aria-hidden',
      'false'
    )
    await userEvent.click(
      canvas.getByRole('button', { name: 'Previous featured event' })
    )
    await expect(firstLink.parentElement).toHaveAttribute(
      'aria-hidden',
      'false'
    )
  }
}

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

export const Mobile: Story = {
  globals: {
    viewport: { value: 'mobile1', isRotated: false }
  }
}
