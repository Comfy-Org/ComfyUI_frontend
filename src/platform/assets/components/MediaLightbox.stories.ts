import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import MediaLightbox from '@/components/sidebar/tabs/queue/MediaLightbox.vue'
import type { AugmentedResultItem } from '@/stores/resultItem'

type MockItem = Pick<AugmentedResultItem, 'filename' | 'url'>

const SAMPLE_IMAGES: MockItem[] = [
  {
    filename: 'landscape.jpg',
    url: 'https://i.imgur.com/OB0y6MR.jpg'
  },
  {
    filename: 'portrait.jpg',
    url: 'https://i.imgur.com/CzXTtJV.jpg'
  },
  {
    filename: 'nature.jpg',
    url: 'https://farm9.staticflickr.com/8505/8441256181_4e98d8bff5_z_d.jpg'
  }
]

const meta: Meta<typeof MediaLightbox> = {
  title: 'Platform/Assets/MediaLightbox',
  component: MediaLightbox
}

export default meta
type Story = StoryObj<typeof meta>

export const MultipleImages: Story = {
  render: () => ({
    components: { MediaLightbox },
    setup() {
      const activeIndex = ref(0)
      const items = SAMPLE_IMAGES as AugmentedResultItem[]
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
            Open {{ item.filename }}
          </button>
        </div>
        <MediaLightbox
          v-model:active-index="activeIndex"
          :all-gallery-items="items"
        />
      </div>
    `
  })
}

export const SingleImage: Story = {
  render: () => ({
    components: { MediaLightbox },
    setup() {
      const activeIndex = ref(-1)
      const items = [SAMPLE_IMAGES[0]] as AugmentedResultItem[]
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
          :all-gallery-items="items"
        />
      </div>
    `
  })
}

export const Closed: Story = {
  render: () => ({
    components: { MediaLightbox },
    setup() {
      const activeIndex = ref(-1)
      const items = SAMPLE_IMAGES as AugmentedResultItem[]
      return { activeIndex, items }
    },
    template: `
      <div>
        <p class="mb-4 text-sm text-muted-foreground">
          Lightbox is closed (activeIndex = -1). Click a button to open.
        </p>
        <div class="flex gap-2">
          <button
            v-for="(item, i) in items"
            :key="i"
            class="rounded border px-3 py-1 text-sm"
            @click="activeIndex = i"
          >
            {{ item.filename }}
          </button>
        </div>
        <MediaLightbox
          v-model:active-index="activeIndex"
          :all-gallery-items="items"
        />
      </div>
    `
  })
}
