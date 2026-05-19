import type {
  ComponentPropsAndSlots,
  Meta,
  StoryObj
} from '@storybook/vue3-vite'
import { ref, toRefs } from 'vue'

import StarRating from './StarRating.vue'
import { provideStarRatingHost } from './starRatingHost'

type StoryArgs = ComponentPropsAndSlots<typeof StarRating>

const meta: Meta<StoryArgs> = {
  title: 'Components/StarRating',
  component: StarRating,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  argTypes: {
    disabled: { control: 'boolean' },
    readonly: { control: 'boolean' },
    showCount: { control: 'boolean' },
    max: { control: 'number' }
  },
  args: {
    disabled: false,
    readonly: false,
    showCount: false,
    max: 5
  },
  decorators: [
    (story) => ({
      components: { story },
      template: '<div class="w-fit"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => ({
    components: { StarRating },
    setup() {
      const { disabled, readonly, showCount, max } = toRefs(args)
      const value = ref(0)
      return { value, disabled, readonly, showCount, max }
    },
    template:
      '<StarRating v-model="value" :disabled :readonly :show-count :max />'
  })
}

export const WithCount: Story = {
  args: { showCount: true },
  render: (args) => ({
    components: { StarRating },
    setup() {
      const { disabled, readonly, showCount, max } = toRefs(args)
      const value = ref(3)
      return { value, disabled, readonly, showCount, max }
    },
    template:
      '<StarRating v-model="value" :disabled :readonly :show-count :max />'
  })
}

export const Disabled: Story = {
  args: { disabled: true },
  render: (args) => ({
    components: { StarRating },
    setup() {
      const { disabled, readonly, max } = toRefs(args)
      const value = ref(3)
      return { value, disabled, readonly, max }
    },
    template: '<StarRating v-model="value" :disabled :readonly :max />'
  })
}

export const Readonly: Story = {
  args: { readonly: true },
  render: (args) => ({
    components: { StarRating },
    setup() {
      const { disabled, readonly, max } = toRefs(args)
      const value = ref(3)
      return { value, disabled, readonly, max }
    },
    template: '<StarRating v-model="value" :disabled :readonly :max />'
  })
}

export const ThreeStars: Story = {
  render: () => ({
    components: { StarRating },
    setup() {
      const value = ref(3)
      return { value }
    },
    template: '<StarRating v-model="value" />'
  })
}

export const FiveStars: Story = {
  render: () => ({
    components: { StarRating },
    setup() {
      const value = ref(5)
      return { value }
    },
    template: '<StarRating v-model="value" />'
  })
}

export const OverlayHostHover: Story = {
  render: () => ({
    components: { StarRating },
    setup() {
      const value = ref(0)
      const hostRef = ref<HTMLElement>()
      provideStarRatingHost(hostRef)
      return { value, hostRef }
    },
    template: `
      <div
        ref="hostRef"
        class="relative size-64 rounded-lg bg-modal-card-placeholder-background"
      >
        <StarRating
          v-model="value"
          presentation="overlay"
          class="absolute right-2 bottom-2"
        />
      </div>
    `
  }),
  parameters: {
    docs: {
      description: {
        story:
          'Overlay on a hoverable host: stars appear at 60% when the host is hovered (unrated); hover stars to rate at full opacity. Set a rating to keep stars visible.'
      }
    }
  }
}
