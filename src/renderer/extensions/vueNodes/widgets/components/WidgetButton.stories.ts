import type {
  ComponentPropsAndSlots,
  Meta,
  StoryObj
} from '@storybook/vue3-vite'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import WidgetButton from './WidgetButton.vue'

interface StoryArgs extends ComponentPropsAndSlots<typeof WidgetButton> {
  label: string
  iconClass: string
}

const meta: Meta<StoryArgs> = {
  title: 'Widgets/WidgetButton',
  component: WidgetButton,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  argTypes: {
    label: { control: 'text' },
    iconClass: { control: 'text' }
  },
  args: {
    label: '',
    iconClass: ''
  },
  decorators: [
    (story) => ({
      components: { story },
      template: '<div class="w-60"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

function createWidget(
  overrides: {
    name?: string
    label?: string
    iconClass?: string
    callback?: () => void
  } = {}
): SimplifiedWidget<void> {
  return {
    name: overrides.name ?? 'Run',
    type: 'button',
    value: undefined,
    label: overrides.label,
    callback: overrides.callback,
    options: {
      ...(overrides.iconClass ? { iconClass: overrides.iconClass } : {})
    }
  }
}

export const Default: Story = {
  render: (args) => ({
    components: { WidgetButton },
    setup() {
      const widget = createWidget({
        label: args.label || undefined,
        iconClass: args.iconClass || undefined,
        callback: () => {}
      })
      return { widget }
    },
    template: '<WidgetButton :widget="widget" />'
  })
}

export const WithIcon: Story = {
  args: { iconClass: 'pi pi-star' },
  render: (args) => ({
    components: { WidgetButton },
    setup() {
      const widget = createWidget({
        name: 'Favorite',
        iconClass: args.iconClass || 'pi pi-star',
        callback: () => {}
      })
      return { widget }
    },
    template: '<WidgetButton :widget="widget" />'
  })
}

export const WithLabel: Story = {
  args: { label: 'Execute Workflow' },
  render: (args) => ({
    components: { WidgetButton },
    setup() {
      const widget = createWidget({
        name: 'run',
        label: args.label || 'Execute Workflow',
        callback: () => {}
      })
      return { widget }
    },
    template: '<WidgetButton :widget="widget" />'
  })
}

export const WithLabelAndIcon: Story = {
  args: { label: 'Save', iconClass: 'pi pi-save' },
  render: (args) => ({
    components: { WidgetButton },
    setup() {
      const widget = createWidget({
        name: 'save',
        label: args.label || 'Save',
        iconClass: args.iconClass || 'pi pi-save',
        callback: () => {}
      })
      return { widget }
    },
    template: '<WidgetButton :widget="widget" />'
  })
}

export const NoCallback: Story = {
  render: () => ({
    components: { WidgetButton },
    setup() {
      const widget = createWidget({ name: 'Disabled Action' })
      return { widget }
    },
    template: '<WidgetButton :widget="widget" />'
  })
}
