import type {
  ComponentPropsAndSlots,
  Meta,
  StoryObj
} from '@storybook/vue3-vite'
import { ref } from 'vue'

import ImageUpload from './ImageUpload.vue'

const meta: Meta<ComponentPropsAndSlots<typeof ImageUpload>> = {
  title: 'Components/ImageUpload',
  component: ImageUpload,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  decorators: [
    (story) => ({
      components: { story },
      template: '<div class="w-60"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => ({
    components: { ImageUpload },
    setup() {
      const url = ref('')
      return { url }
    },
    template: '<ImageUpload v-model="url" />'
  })
}

export const WithImage: Story = {
  render: () => ({
    components: { ImageUpload },
    setup() {
      const url = ref('/api/view?filename=mountain+lake.png&type=input')
      return { url }
    },
    template: '<ImageUpload v-model="url" />'
  })
}

export const Loading: Story = {
  render: () => ({
    components: { ImageUpload },
    setup() {
      const url = ref('')
      return { url }
    },
    template: '<ImageUpload v-model="url" loading />'
  })
}

export const Disabled: Story = {
  render: () => ({
    components: { ImageUpload },
    setup() {
      const url = ref('')
      return { url }
    },
    template: '<ImageUpload v-model="url" disabled />'
  })
}
