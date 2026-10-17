import type { Meta, StoryObj } from '@storybook/vue3-vite'

import SiteVideo from './SiteVideo.vue'

const meta: Meta<typeof SiteVideo> = {
  title: 'Website/Common/SiteVideo',
  component: SiteVideo,
  tags: ['autodocs', 'stable'],
  decorators: [
    () => ({
      template:
        '<div class="bg-primary-comfy-ink mx-auto max-w-4xl p-8"><story /></div>'
    })
  ],
  args: {
    name: 'hero',
    baseUrl: 'https://media.comfy.org/website/minimax',
    width: 1280,
    formats: ['webm', 'mp4'],
    poster: '/images/demos/image-to-video-thumb.webp',
    alt: 'Generated video example',
    controls: true,
    videoClass: 'aspect-video rounded-4xl object-cover'
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const WithControls: Story = {}

export const DecorativeAutoplay: Story = {
  args: {
    alt: undefined,
    autoplay: true,
    loop: true,
    muted: true,
    controls: false
  }
}

export const Mp4Only: Story = {
  args: {
    formats: ['mp4']
  }
}
