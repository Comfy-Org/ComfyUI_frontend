import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import type { GalleryValue } from './WidgetGalleriaOriginal.vue'
import WidgetGalleriaOriginal from './WidgetGalleriaOriginal.vue'

const SAMPLE_IMAGES = [
  'https://picsum.photos/seed/comfy1/600/400',
  'https://picsum.photos/seed/comfy2/600/400',
  'https://picsum.photos/seed/comfy3/600/400',
  'https://picsum.photos/seed/comfy4/600/400',
  'https://picsum.photos/seed/comfy5/600/400'
]

const meta: Meta<typeof WidgetGalleriaOriginal> = {
  title: 'Widgets/WidgetGalleriaOriginal (PrimeVue)',
  component: WidgetGalleriaOriginal,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Original PrimeVue Galleria-based widget before migration to DisplayCarousel. For comparison purposes only.'
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
    components: { WidgetGalleriaOriginal },
    setup() {
      const value = ref<GalleryValue>([...SAMPLE_IMAGES])
      const widget: SimplifiedWidget<GalleryValue> = {
        name: 'gallery',
        type: 'array',
        value: []
      }
      return { value, widget }
    },
    template: '<WidgetGalleriaOriginal :widget="widget" v-model="value" />'
  })
}

export const SingleImage: Story = {
  render: () => ({
    components: { WidgetGalleriaOriginal },
    setup() {
      const value = ref<GalleryValue>([SAMPLE_IMAGES[0]])
      const widget: SimplifiedWidget<GalleryValue> = {
        name: 'gallery',
        type: 'array',
        value: []
      }
      return { value, widget }
    },
    template: '<WidgetGalleriaOriginal :widget="widget" v-model="value" />'
  })
}
