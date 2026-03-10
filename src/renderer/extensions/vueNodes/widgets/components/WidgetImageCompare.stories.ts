import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import type { ImageCompareValue } from './WidgetImageCompare.vue'
import WidgetImageCompare from './WidgetImageCompare.vue'

function createSampleImage(label: string, fill: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">` +
    `<rect width="512" height="512" fill="${fill}" />` +
    `<text x="50%" y="50%" fill="white" font-size="40"` +
    ` text-anchor="middle" dominant-baseline="middle">` +
    `${label}</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

const SAMPLE_BEFORE = createSampleImage('Before', '#475569')
const SAMPLE_AFTER = createSampleImage('After', '#0f766e')

const meta: Meta<typeof WidgetImageCompare> = {
  title: 'Components/Display/ImageCompare',
  component: WidgetImageCompare,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  decorators: [
    (story) => ({
      components: { story },
      template: '<div class="w-88 h-80"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => ({
    components: { WidgetImageCompare },
    setup() {
      const widget = ref<SimplifiedWidget<ImageCompareValue>>({
        name: 'compare',
        type: 'IMAGE_COMPARE',
        value: {
          beforeImages: [SAMPLE_BEFORE],
          afterImages: [SAMPLE_AFTER]
        }
      })
      return { widget }
    },
    template: '<WidgetImageCompare :widget="widget" />'
  })
}

export const WithBatchNavigation: Story = {
  render: () => ({
    components: { WidgetImageCompare },
    setup() {
      const widget = ref<SimplifiedWidget<ImageCompareValue>>({
        name: 'compare',
        type: 'IMAGE_COMPARE',
        value: {
          beforeImages: [SAMPLE_BEFORE, SAMPLE_AFTER],
          afterImages: [SAMPLE_AFTER, SAMPLE_BEFORE],
          beforeAlt: 'Before batch',
          afterAlt: 'After batch'
        }
      })
      return { widget }
    },
    template: '<WidgetImageCompare :widget="widget" />'
  })
}

export const SingleImageFallback: Story = {
  render: () => ({
    components: { WidgetImageCompare },
    setup() {
      const widget = ref<SimplifiedWidget<string>>({
        name: 'compare',
        type: 'IMAGE_COMPARE',
        value: SAMPLE_BEFORE
      })
      return { widget }
    },
    template: '<WidgetImageCompare :widget="widget" />'
  })
}

export const NoImages: Story = {
  render: () => ({
    components: { WidgetImageCompare },
    setup() {
      const widget = ref<SimplifiedWidget<ImageCompareValue>>({
        name: 'compare',
        type: 'IMAGE_COMPARE',
        value: {}
      })
      return { widget }
    },
    template: '<WidgetImageCompare :widget="widget" />'
  })
}
