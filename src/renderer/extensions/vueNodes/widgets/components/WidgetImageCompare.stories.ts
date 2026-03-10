import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import type { ImageCompareValue } from './WidgetImageCompare.vue'
import WidgetImageCompare from './WidgetImageCompare.vue'

const SAMPLE_BEFORE = 'https://picsum.photos/seed/before/512/512'
const SAMPLE_AFTER = 'https://picsum.photos/seed/after/512/512'

const meta: Meta<typeof WidgetImageCompare> = {
  title: 'Widgets/WidgetImageCompare',
  component: WidgetImageCompare,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  decorators: [
    (story) => ({
      components: { story },
      template:
        '<div class="w-88 h-80 bg-node-component-surface rounded-lg"><story /></div>'
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
