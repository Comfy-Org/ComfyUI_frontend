import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { computed, ref, toRefs } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import WidgetGalleria from './WidgetGalleria.vue'
import type { GalleryImage, GalleryValue } from './WidgetGalleria.vue'

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

interface StoryArgs {
  showThumbnails: boolean
  showItemNavigators: boolean
}

const meta: Meta<StoryArgs> = {
  title: 'Widgets/WidgetGalleria',
  component: WidgetGalleria,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Image gallery carousel with thumbnail navigation. Navigation always wraps around. Supports string URLs and structured image objects with separate thumbnail sources.'
      }
    }
  },
  argTypes: {
    showThumbnails: { control: 'boolean' },
    showItemNavigators: { control: 'boolean' }
  },
  args: {
    showThumbnails: true,
    showItemNavigators: true
  },
  decorators: [
    (story) => ({
      components: { story },
      template: '<div class="w-96"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => ({
    components: { WidgetGalleria },
    setup() {
      const { showThumbnails, showItemNavigators } = toRefs(args)
      const value = ref<GalleryValue>([...SAMPLE_IMAGES])
      const widget = computed<
        SimplifiedWidget<GalleryValue, Record<string, unknown>>
      >(() => ({
        name: 'gallery',
        type: 'array',
        value: [],
        options: {
          showThumbnails: showThumbnails.value,
          showItemNavigators: showItemNavigators.value
        }
      }))
      return { value, widget }
    },
    template: '<WidgetGalleria :widget="widget" v-model="value" />'
  })
}

export const SingleImage: Story = {
  render: () => ({
    components: { WidgetGalleria },
    setup() {
      const value = ref<GalleryValue>([SAMPLE_IMAGES[0]])
      const widget: SimplifiedWidget<GalleryValue, Record<string, unknown>> = {
        name: 'gallery',
        type: 'array',
        value: []
      }
      return { value, widget }
    },
    template: '<WidgetGalleria :widget="widget" v-model="value" />'
  })
}

export const WithImageObjects: Story = {
  render: () => ({
    components: { WidgetGalleria },
    setup() {
      const value = ref<GalleryValue>([...SAMPLE_IMAGE_OBJECTS])
      const widget: SimplifiedWidget<GalleryValue, Record<string, unknown>> = {
        name: 'gallery',
        type: 'array',
        value: []
      }
      return { value, widget }
    },
    template: '<WidgetGalleria :widget="widget" v-model="value" />'
  })
}

export const NoThumbnails: Story = {
  args: { showThumbnails: false },
  render: () => ({
    components: { WidgetGalleria },
    setup() {
      const value = ref<GalleryValue>([...SAMPLE_IMAGES.slice(0, 3)])
      const widget: SimplifiedWidget<GalleryValue, Record<string, unknown>> = {
        name: 'gallery',
        type: 'array',
        value: [],
        options: { showThumbnails: false }
      }
      return { value, widget }
    },
    template: '<WidgetGalleria :widget="widget" v-model="value" />'
  })
}

export const Empty: Story = {
  render: () => ({
    components: { WidgetGalleria },
    setup() {
      const value = ref<GalleryValue>([])
      const widget: SimplifiedWidget<GalleryValue, Record<string, unknown>> = {
        name: 'gallery',
        type: 'array',
        value: []
      }
      return { value, widget }
    },
    template: '<WidgetGalleria :widget="widget" v-model="value" />'
  })
}
