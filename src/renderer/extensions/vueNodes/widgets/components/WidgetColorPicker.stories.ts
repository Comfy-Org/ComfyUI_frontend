import type {
  ComponentPropsAndSlots,
  Meta,
  StoryObj
} from '@storybook/vue3-vite'
import { ref, toRefs, watchEffect } from 'vue'

import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { toNodeId } from '@comfyorg/graph-model/nodeId'
import { widgetId as toWidgetId } from '@comfyorg/graph-model/widgetId'
import type { WidgetStateInit } from '@comfyorg/graph-model/widgetState'
import type { ColorFormat } from '@comfyorg/shared-frontend-utils/colorUtil'

import type { IWidgetOptions } from '@comfyorg/graph-model/widgets'

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

const STORY_GRAPH_ID = '00000000-0000-4000-8000-0000000000bb'
let storyNodeCount = 0

function useStoryWidget(
  init: () => WidgetStateInit<string, string, WidgetOptions> & {
    name: string
  }
) {
  storyNodeCount += 1
  const id = toWidgetId(STORY_GRAPH_ID, toNodeId(storyNodeCount), init().name)
  watchEffect(() => useWidgetValueStore().registerWidget(id, init()))
  return id
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => ({
    components: { WidgetColorPicker },
    setup() {
      const { format } = toRefs(args)
      const value = ref('#E06CBD')
      const widgetId = useStoryWidget(() => ({
        name: 'color',
        type: 'STRING',
        value: '',
        options: { format: format.value }
      }))
      return { value, widgetId }
    },
    template: '<WidgetColorPicker :widget-id="widgetId" v-model="value" />'
  })
}

export const RGBFormat: Story = {
  args: { format: 'rgb' },
  render: (args) => ({
    components: { WidgetColorPicker },
    setup() {
      const { format } = toRefs(args)
      const value = ref('#3498DB')
      const widgetId = useStoryWidget(() => ({
        name: 'color',
        type: 'STRING',
        value: '',
        options: { format: format.value }
      }))
      return { value, widgetId }
    },
    template: '<WidgetColorPicker :widget-id="widgetId" v-model="value" />'
  })
}

export const HSBFormat: Story = {
  args: { format: 'hsb' },
  render: (args) => ({
    components: { WidgetColorPicker },
    setup() {
      const { format } = toRefs(args)
      const value = ref('#2ECC71')
      const widgetId = useStoryWidget(() => ({
        name: 'color',
        type: 'STRING',
        value: '',
        options: { format: format.value }
      }))
      return { value, widgetId }
    },
    template: '<WidgetColorPicker :widget-id="widgetId" v-model="value" />'
  })
}

export const CustomColor: Story = {
  render: (args) => ({
    components: { WidgetColorPicker },
    setup() {
      const { format } = toRefs(args)
      const value = ref('#FF5733')
      const widgetId = useStoryWidget(() => ({
        name: 'accent_color',
        type: 'STRING',
        value: '',
        options: { format: format.value }
      }))
      return { value, widgetId }
    },
    template: '<WidgetColorPicker :widget-id="widgetId" v-model="value" />'
  })
}

export const WithLabel: Story = {
  render: () => ({
    components: { WidgetColorPicker },
    setup() {
      const value = ref('#9B59B6')
      const widgetId = useStoryWidget(() => ({
        name: 'background',
        type: 'STRING',
        value: '',
        label: 'Background Color',
        options: { format: 'hex' }
      }))
      return { value, widgetId }
    },
    template: '<WidgetColorPicker :widget-id="widgetId" v-model="value" />'
  })
}
