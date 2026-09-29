import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import type { LightboxItem } from '@/types/lightboxItem'

import MediaLightbox from './MediaLightbox.vue'

const SAMPLE_IMAGES: LightboxItem[] = [
  {
    kind: 'image',
    alt: 'landscape.jpg',
    url: 'https://i.imgur.com/OB0y6MR.jpg'
  },
  {
    kind: 'image',
    alt: 'portrait.jpg',
    url: 'https://i.imgur.com/CzXTtJV.jpg'
  },
  {
    kind: 'image',
    alt: 'nature.jpg',
    url: 'https://farm9.staticflickr.com/8505/8441256181_4e98d8bff5_z_d.jpg'
  }
]

const meta: Meta<typeof MediaLightbox> = {
  title: 'Components/MediaLightbox',
  component: MediaLightbox
}

export default meta
type Story = StoryObj<typeof meta>

export const MultipleImages: Story = {
  render: () => ({
    components: { MediaLightbox },
    setup() {
      const activeIndex = ref(0)
      const items = SAMPLE_IMAGES
      return { activeIndex, items }
    },
    template: `
      <div>
        <p class="mb-4 text-sm text-muted-foreground">
          Use arrow keys to navigate, Escape to close. Click backdrop to close.
        </p>
        <div class="flex gap-2">
          <button
            v-for="(item, i) in items"
            :key="i"
            class="rounded border px-3 py-1 text-sm"
            @click="activeIndex = i"
          >
            Open {{ item.alt }}
          </button>
        </div>
        <MediaLightbox
          v-model:active-index="activeIndex"
          :items="items"
        />
      </div>
    `
  })
}

export const SingleImage: Story = {
  render: () => ({
    components: { MediaLightbox },
    setup() {
      const activeIndex = ref<number | null>(null)
      const items = SAMPLE_IMAGES.slice(0, 1)
      return { activeIndex, items }
    },
    template: `
      <div>
        <p class="mb-4 text-sm text-muted-foreground">
          Single image — no navigation buttons shown.
        </p>
        <button
          class="rounded border px-3 py-1 text-sm"
          @click="activeIndex = 0"
        >
          Open lightbox
        </button>
        <MediaLightbox
          v-model:active-index="activeIndex"
          :items="items"
        />
      </div>
    `
  })
}

export const Closed: Story = {
  render: () => ({
    components: { MediaLightbox },
    setup() {
      const activeIndex = ref<number | null>(null)
      const items = SAMPLE_IMAGES
      return { activeIndex, items }
    },
    template: `
      <div>
        <p class="mb-4 text-sm text-muted-foreground">
          Lightbox is closed. Click a button to open.
        </p>
        <div class="flex gap-2">
          <button
            v-for="(item, i) in items"
            :key="i"
            class="rounded border px-3 py-1 text-sm"
            @click="activeIndex = i"
          >
            {{ item.alt }}
          </button>
        </div>
        <MediaLightbox
          v-model:active-index="activeIndex"
          :items="items"
        />
      </div>
    `
  })
}
