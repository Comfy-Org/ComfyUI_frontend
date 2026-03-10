import type {
  ComponentPropsAndSlots,
  Meta,
  StoryObj
} from '@storybook/vue3-vite'

import DropZone from './DropZone.vue'

type StoryArgs = ComponentPropsAndSlots<typeof DropZone>

const baseIndicator = {
  label: 'Click to browse or drag an image',
  iconClass: 'icon-[lucide--image]'
}

const renderStory = (args: StoryArgs) => ({
  components: { DropZone },
  setup() {
    const onDragOver = () => true
    const onDragDrop = async () => true
    return { args, onDragOver, onDragDrop }
  },
  template: `
    <DropZone
      v-bind="args"
      :on-drag-over="onDragOver"
      :on-drag-drop="onDragDrop"
    />
  `
})

const meta: Meta<StoryArgs> = {
  title: 'Components/LinearMode/DropZone',
  component: DropZone,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: [
          'Linear mode drag-and-drop target with a file upload indicator.',
          'The linked Figma reference defines two states for this element: Default and Hover.',
          'These stories use `forceHovered` to preview the hover treatment without requiring a live drag event.'
        ].join(' ')
      }
    }
  },
  argTypes: {
    onDragOver: { table: { disable: true } },
    onDragDrop: { table: { disable: true } },
    dropIndicator: { control: false },
    forceHovered: {
      control: 'boolean',
      description: 'Preview-only override for the drag-hover visual state.'
    }
  },
  args: {
    forceHovered: false,
    dropIndicator: baseIndicator
  },
  decorators: [
    (story) => ({
      components: { story },
      template: `
        <div class="w-[440px] rounded-xl bg-component-node-background p-4">
          <story />
        </div>
      `
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: renderStory
}

export const Hover: Story = {
  args: {
    forceHovered: true
  },
  render: renderStory
}
