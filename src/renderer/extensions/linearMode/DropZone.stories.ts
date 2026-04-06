import type {
  ComponentPropsAndSlots,
  Meta,
  StoryObj
} from '@storybook/vue3-vite'
import { ref } from 'vue'

import DropZone from './DropZone.vue'

type StoryArgs = ComponentPropsAndSlots<typeof DropZone>

const defaultLabel = 'Click to browse or drag an image'
const defaultIconClass = 'icon-[lucide--image]'

function createFileInput(onFile: (file: File) => void) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.addEventListener('change', () => {
    const file = input.files?.[0]
    if (file) onFile(file)
  })
  return input
}

function fileToObjectUrl(file: File): string {
  return URL.createObjectURL(file)
}

function extractDroppedImageFile(e: DragEvent): File | undefined {
  return Array.from(e.dataTransfer?.files ?? []).find((f) =>
    f.type.startsWith('image/')
  )
}

const renderStory = (args: StoryArgs) => ({
  components: { DropZone },
  setup() {
    const imageUrl = ref<string | undefined>(undefined)
    const hovered = ref(false)

    function handleFile(file: File) {
      imageUrl.value = fileToObjectUrl(file)
    }

    const onDragOver = (e: DragEvent) => {
      if (!e.dataTransfer?.items) return false
      return Array.from(e.dataTransfer.items).some(
        (item) => item.kind === 'file' && item.type.startsWith('image/')
      )
    }

    const onDragDrop = (e: DragEvent) => {
      const file = extractDroppedImageFile(e)
      if (file) handleFile(file)
      return !!file
    }

    const onClick = () => {
      createFileInput(handleFile).click()
    }

    const dropIndicator = ref({
      ...args.dropIndicator,
      onClick
    })

    return { args, onDragOver, onDragDrop, dropIndicator, imageUrl, hovered }
  },
  template: `
    <div
      @mouseenter="hovered = true"
      @mouseleave="hovered = false"
    >
      <DropZone
        v-bind="args"
        :on-drag-over="onDragOver"
        :on-drag-drop="onDragDrop"
        :force-hovered="hovered"
        :drop-indicator="{
          ...dropIndicator,
          imageUrl: imageUrl ?? dropIndicator.imageUrl
        }"
      />
    </div>
  `
})

const meta: Meta<StoryArgs> = {
  title: 'Components/FileUpload',
  component: DropZone,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Linear mode drag-and-drop target with a file upload indicator. Click to browse or drag an image file to upload.'
      }
    }
  },
  argTypes: {
    onDragOver: { table: { disable: true } },
    onDragDrop: { table: { disable: true } },
    dropIndicator: { control: false },
    forceHovered: { table: { disable: true } }
  },
  args: {
    dropIndicator: {
      label: defaultLabel,
      iconClass: defaultIconClass
    }
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
