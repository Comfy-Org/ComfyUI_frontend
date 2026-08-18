import type { Meta, StoryObj } from '@storybook/vue3-vite'

import FeaturedCarousel02 from './FeaturedCarousel02.vue'
import type { FeaturedSplitSlide } from './FeaturedCarousel02.vue'

const slides: FeaturedSplitSlide[] = [
  {
    id: 'seedance-2-5',
    media: {
      type: 'video',
      src: 'https://media.comfy.org/website/seedance-2.5/hero.mp4',
      poster: 'https://media.comfy.org/website/seedance-2.5/hero-poster.webp',
      alt: 'Seedance 2.5 cinematic video reel'
    },
    eyebrow: 'New model release',
    title: 'Seedance 2.5',
    body: "ByteDance's cinematic video model — multi-shot sequences with native audio, text or image in. You direct on the canvas; Seedance renders the cut.",
    primaryCta: { label: 'Explore Seedance 2.5', href: '/seedance-2.5' },
    secondaryCta: {
      label: 'Try workflow',
      href: 'https://cloud.comfy.org/?template=api_seedance2_5_r2v'
    },
    tags: ['Partner Node'],
    autoplayMs: 17000
  },
  {
    id: 'ltx-2-5',
    media: {
      type: 'video',
      src: 'https://media.comfy.org/website/ltx-2.5/hero.mp4',
      poster: 'https://media.comfy.org/website/ltx-2.5/hero-poster.webp',
      alt: 'LTX 2.5 video generation reel'
    },
    eyebrow: 'New model release',
    title: 'LTX 2.5',
    body: 'The fastest video generation model, now with sharper prompt adherence and audio. Cinematic detail on faces and fine textures with Diffusion Fidelity Rendering.',
    primaryCta: { label: 'Explore LTX 2.5', href: '/ltx-2.5' },
    secondaryCta: {
      label: 'Try for free',
      href: 'https://cloud.comfy.org/?template=video_ltx2_5_i2v'
    },
    tags: ['Open Source', 'Partner Node'],
    autoplayMs: 20000
  },
  {
    id: 'wan-animate-2',
    media: {
      type: 'video',
      src: 'https://media.comfy.org/website/wan-animate-2/hero.mp4',
      poster: 'https://media.comfy.org/website/wan-animate-2/hero-poster.webp',
      alt: 'Wan Animate 2 character motion transfer reel'
    },
    eyebrow: 'New model release',
    title: 'Wan Animate 2',
    body: 'Upload a reference image of your character and a video of the motion you want. Wan Animate 2 transfers that motion onto your character, end to end.',
    primaryCta: { label: 'Explore Wan Animate 2', href: '/wan-animate-2' },
    secondaryCta: {
      label: 'Try for free',
      href: 'https://cloud.comfy.org/?template=video_wan_animate2'
    },
    tags: ['Open Weights'],
    autoplayMs: 18400
  },
  {
    id: 'minimax-h3',
    media: {
      type: 'video',
      src: 'https://media.comfy.org/website/minimax/hero.mp4',
      poster: 'https://media.comfy.org/website/minimax/hero-poster.webp',
      alt: 'MiniMax H3 multi-modal video reel'
    },
    eyebrow: 'New model release',
    title: 'MiniMax H3',
    body: 'Full multi-modal I/O, native stereo clip. Up to 2K, 5 to 15s per generation. H3 actually conditions on input audio where others overwrite or drop it.',
    primaryCta: { label: 'Explore MiniMax H3', href: '/minimax-h3' },
    secondaryCta: {
      label: 'Try for free',
      href: 'https://cloud.comfy.org/?share=a781503cf508'
    },
    tags: ['Open Weights', 'Partner Node'],
    autoplayMs: 8000
  }
]

const meta: Meta<typeof FeaturedCarousel02> = {
  title: 'Website/Blocks/FeaturedCarousel02',
  component: FeaturedCarousel02,
  tags: ['autodocs'],
  args: { slides }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const SingleSlide: Story = {
  args: {
    slides: slides.slice(0, 1)
  }
}

export const ImageSlides: Story = {
  args: {
    slides: [
      {
        id: 'headphones',
        media: {
          type: 'image',
          src: 'https://media.comfy.org/website/fdct/headphones.png',
          alt: 'Product render of headphones'
        },
        eyebrow: 'Community spotlight',
        title: 'Product renders in one pass',
        body: 'Photoreal product shots straight from a workflow — swap materials, lighting, and camera moves without re-rendering from scratch.',
        primaryCta: {
          label: 'Open workflow',
          href: 'https://comfy.org/workflows/e8099b642c9f-e8099b642c9f/'
        },
        tags: ['Workflow']
      },
      {
        id: 'walkthrough',
        media: {
          type: 'image',
          src: 'https://media.comfy.org/website/learning/cleanplate_walkthrough_v03_thumbnail.jpg',
          alt: 'Clean plate walkthrough thumbnail'
        },
        eyebrow: 'Tutorial',
        title: 'Clean plates, start to finish',
        body: 'A guided walkthrough of the clean-plate pipeline, from ingest to final comp.',
        primaryCta: { label: 'Watch now', href: '/learning' },
        secondaryCta: {
          label: 'Read the docs',
          href: 'https://docs.comfy.org/',
          newTab: true
        }
      }
    ]
  }
}
