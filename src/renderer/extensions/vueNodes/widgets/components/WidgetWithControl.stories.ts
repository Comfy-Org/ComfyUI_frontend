import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import type {
  ControlOptions,
  SimplifiedControlWidget
} from '@/types/simplifiedWidget'

import WidgetInputText from './WidgetInputText.vue'
import WidgetWithControl from './WidgetWithControl.vue'

function createControlWidget(
  mode: ControlOptions = 'randomize'
): SimplifiedControlWidget<string> {
  return {
    name: 'seed',
    type: 'STRING',
    value: '',
    controlWidget: {
      value: mode,
      update: () => {}
    }
  }
}

const meta = {
  title: 'Widgets/WidgetWithControl',
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  decorators: [
    (story) => ({
      components: { story },
      template:
        '<div class="grid grid-cols-[auto_1fr] gap-1 w-80"><story /></div>'
    })
  ]
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Randomize: Story = {
  render: () => ({
    components: { WidgetWithControl, WidgetInputText },
    setup() {
      const value = ref('42')
      const widget = createControlWidget('randomize')
      return { value, widget, WidgetInputText }
    },
    template:
      '<WidgetWithControl :widget="widget" :component="WidgetInputText" v-model="value" />'
  })
}

export const Fixed: Story = {
  render: () => ({
    components: { WidgetWithControl, WidgetInputText },
    setup() {
      const value = ref('42')
      const widget = createControlWidget('fixed')
      return { value, widget, WidgetInputText }
    },
    template:
      '<WidgetWithControl :widget="widget" :component="WidgetInputText" v-model="value" />'
  })
}

export const Increment: Story = {
  render: () => ({
    components: { WidgetWithControl, WidgetInputText },
    setup() {
      const value = ref('42')
      const widget = createControlWidget('increment')
      return { value, widget, WidgetInputText }
    },
    template:
      '<WidgetWithControl :widget="widget" :component="WidgetInputText" v-model="value" />'
  })
}

export const Decrement: Story = {
  render: () => ({
    components: { WidgetWithControl, WidgetInputText },
    setup() {
      const value = ref('42')
      const widget = createControlWidget('decrement')
      return { value, widget, WidgetInputText }
    },
    template:
      '<WidgetWithControl :widget="widget" :component="WidgetInputText" v-model="value" />'
  })
}

export const WithLabel: Story = {
  render: () => ({
    components: { WidgetWithControl, WidgetInputText },
    setup() {
      const value = ref('12345')
      const widget: SimplifiedControlWidget<string> = {
        ...createControlWidget('randomize'),
        label: 'Random Seed'
      }
      return { value, widget, WidgetInputText }
    },
    template:
      '<WidgetWithControl :widget="widget" :component="WidgetInputText" v-model="value" />'
  })
}
