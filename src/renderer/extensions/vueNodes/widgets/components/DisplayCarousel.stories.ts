import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import DisplayCarousel from './DisplayCarousel.vue'
import type { GalleryImage, GalleryValue } from './DisplayCarousel.vue'

const SAMPLE_IMAGES = [
  'https://picsum.photos/seed/comfy1/600/400',
  'https://picsum.photos/seed/comfy2/600/400',
  'https://picsum.photos/seed/comfy3/600/400',
  'https://picsum.photos/seed/comfy4/600/400',
  'https://picsum.photos/seed/comfy5/600/400'
]

const SAMPLE_IMAGE_OBJECTS: GalleryImage[] = [
  {
    itemImageSrc: 'https://picsum.photos/seed/obj1/600/400',
    thumbnailImageSrc: 'https://picsum.photos/seed/obj1/120/80',
    alt: 'Mountain landscape'
  },
  {
    itemImageSrc: 'https://picsum.photos/seed/obj2/600/400',
    thumbnailImageSrc: 'https://picsum.photos/seed/obj2/120/80',
    alt: 'Ocean view'
  },
  {
    itemImageSrc: 'https://picsum.photos/seed/obj3/600/400',
    thumbnailImageSrc: 'https://picsum.photos/seed/obj3/120/80',
    alt: 'Forest path'
  }
]

const meta: Meta<typeof DisplayCarousel> = {
  title: 'Components/Display/DisplayCarousel',
  component: DisplayCarousel,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Image gallery with Single (carousel) and Grid display modes. Hover to reveal a toggle button that switches between modes. Grid mode shows images in a responsive grid; clicking an image switches back to single mode focused on that image.'
      }
    }
  },
  decorators: [
    (story) => ({
      components: { story },
      template:
        '<div class="w-80 rounded-xl bg-component-node-background p-4"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => ({
    components: { DisplayCarousel },
    setup() {
      const value = ref<GalleryValue>([...SAMPLE_IMAGES])
      const widget: SimplifiedWidget<GalleryValue, Record<string, unknown>> = {
        name: 'gallery',
        type: 'array',
        value: []
      }
      return { value, widget }
    },
    template: '<DisplayCarousel :widget="widget" v-model="value" />'
  })
}

export const SingleImage: Story = {
  render: () => ({
    components: { DisplayCarousel },
    setup() {
      const value = ref<GalleryValue>([SAMPLE_IMAGES[0]])
      const widget: SimplifiedWidget<GalleryValue, Record<string, unknown>> = {
        name: 'gallery',
        type: 'array',
        value: []
      }
      return { value, widget }
    },
    template: '<DisplayCarousel :widget="widget" v-model="value" />'
  })
}

export const WithImageObjects: Story = {
  render: () => ({
    components: { DisplayCarousel },
    setup() {
      const value = ref<GalleryValue>([...SAMPLE_IMAGE_OBJECTS])
      const widget: SimplifiedWidget<GalleryValue, Record<string, unknown>> = {
        name: 'gallery',
        type: 'array',
        value: []
      }
      return { value, widget }
    },
    template: '<DisplayCarousel :widget="widget" v-model="value" />'
  })
}

export const GridFewImages: Story = {
  render: () => ({
    components: { DisplayCarousel },
    setup() {
      const value = ref<GalleryValue>([...SAMPLE_IMAGES.slice(0, 4)])
      const widget: SimplifiedWidget<GalleryValue, Record<string, unknown>> = {
        name: 'gallery',
        type: 'array',
        value: []
      }
      return { value, widget, displayMode: ref('grid') }
    },
    template: '<DisplayCarousel :widget="widget" v-model="value" />'
  })
}

export const GridManyImages: Story = {
  render: () => ({
    components: { DisplayCarousel },
    setup() {
      const value = ref<GalleryValue>(
        Array.from(
          { length: 25 },
          (_, i) => `https://picsum.photos/seed/grid${i}/200/200`
        )
      )
      const widget: SimplifiedWidget<GalleryValue, Record<string, unknown>> = {
        name: 'gallery',
        type: 'array',
        value: []
      }
      return { value, widget }
    },
    template: '<DisplayCarousel :widget="widget" v-model="value" />'
  })
}

export const Empty: Story = {
  render: () => ({
    components: { DisplayCarousel },
    setup() {
      const value = ref<GalleryValue>([])
      const widget: SimplifiedWidget<GalleryValue, Record<string, unknown>> = {
        name: 'gallery',
        type: 'array',
        value: []
      }
      return { value, widget }
    },
    template: '<DisplayCarousel :widget="widget" v-model="value" />'
  })
}
