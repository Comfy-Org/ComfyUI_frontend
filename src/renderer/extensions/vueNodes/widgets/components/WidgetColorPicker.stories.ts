import type {
  ComponentPropsAndSlots,
  Meta,
  StoryObj
} from '@storybook/vue3-vite'
import { computed, ref, toRefs } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import type { ColorFormat } from '@/utils/colorUtil'

import type { IWidgetOptions } from '@/lib/litegraph/src/types/widgets'

import WidgetColorPicker from './WidgetColorPicker.vue'

type WidgetOptions = IWidgetOptions & { format?: ColorFormat }

interface StoryArgs extends ComponentPropsAndSlots<typeof WidgetColorPicker> {
  format: ColorFormat
}

const meta: Meta<StoryArgs> = {
  title: 'Widgets/WidgetColorPicker',
  component: WidgetColorPicker,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  argTypes: {
    format: {
      control: 'select',
      options: ['hex', 'rgb', 'hsb']
    }
  },
  args: {
    format: 'hex'
  },
  decorators: [
    (story) => ({
      components: { story },
      template:
        '<div class="grid grid-cols-[auto_1fr] gap-1 w-80"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => ({
    components: { WidgetColorPicker },
    setup() {
      const { format } = toRefs(args)
      const value = ref('#E06CBD')
      const widget = computed<SimplifiedWidget<string, WidgetOptions>>(() => ({
        name: 'color',
        type: 'STRING',
        value: '',
        options: { format: format.value }
      }))
      return { value, widget }
    },
    template: '<WidgetColorPicker :widget="widget" v-model="value" />'
  })
}

export const RGBFormat: Story = {
  args: { format: 'rgb' },
  render: (args) => ({
    components: { WidgetColorPicker },
    setup() {
      const { format } = toRefs(args)
      const value = ref('#3498DB')
      const widget = computed<SimplifiedWidget<string, WidgetOptions>>(() => ({
        name: 'color',
        type: 'STRING',
        value: '',
        options: { format: format.value }
      }))
      return { value, widget }
    },
    template: '<WidgetColorPicker :widget="widget" v-model="value" />'
  })
}

export const HSBFormat: Story = {
  args: { format: 'hsb' },
  render: (args) => ({
    components: { WidgetColorPicker },
    setup() {
      const { format } = toRefs(args)
      const value = ref('#2ECC71')
      const widget = computed<SimplifiedWidget<string, WidgetOptions>>(() => ({
        name: 'color',
        type: 'STRING',
        value: '',
        options: { format: format.value }
      }))
      return { value, widget }
    },
    template: '<WidgetColorPicker :widget="widget" v-model="value" />'
  })
}

export const CustomColor: Story = {
  render: (args) => ({
    components: { WidgetColorPicker },
    setup() {
      const { format } = toRefs(args)
      const value = ref('#FF5733')
      const widget = computed<SimplifiedWidget<string, WidgetOptions>>(() => ({
        name: 'accent_color',
        type: 'STRING',
        value: '',
        options: { format: format.value }
      }))
      return { value, widget }
    },
    template: '<WidgetColorPicker :widget="widget" v-model="value" />'
  })
}

export const WithLabel: Story = {
  render: () => ({
    components: { WidgetColorPicker },
    setup() {
      const value = ref('#9B59B6')
      const widget: SimplifiedWidget<string, WidgetOptions> = {
        name: 'background',
        type: 'STRING',
        value: '',
        label: 'Background Color',
        options: { format: 'hex' }
      }
      return { value, widget }
    },
    template: '<WidgetColorPicker :widget="widget" v-model="value" />'
  })
}
