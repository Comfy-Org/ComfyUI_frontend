import { Crop, Eraser, ImagePlus, Lamp, Type } from '@lucide/vue'
import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { fn } from 'storybook/test'
import { ref } from 'vue'

import EditorCompareToggle from './EditorCompareToggle.vue'
import EditorDock from './EditorDock.vue'
import EditorHistory from './EditorHistory.vue'
import EditorMenuButton from './EditorMenuButton.vue'
import EditorResultDock from './EditorResultDock.vue'
import EditorTool from './EditorTool.vue'
import type { EditorView } from './view'

const HISTORY_LABELS = { group: 'History', undo: 'Undo', redo: 'Redo' }

/**
 * The floating toolbar under the stage. Tools go in the default slot and undo
 * and redo in `history`; the divider between them hides when either is empty.
 */
const meta: Meta<typeof EditorDock> = {
  title: 'Website/Workshop/AppEditor/Dock',
  component: EditorDock,
  tags: ['autodocs'],
  args: { label: 'Tools' },
  decorators: [
    () => ({
      template:
        '<div class="flex h-64 items-end justify-center bg-primary-comfy-ink p-8"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

/** While editing: tools, an add menu that opens upwards, and history. */
export const Editing: Story = {
  render: (args) => ({
    components: {
      EditorDock,
      EditorTool,
      EditorMenuButton,
      EditorCompareToggle,
      EditorHistory
    },
    setup() {
      const tool = ref('light')
      const comparing = ref(false)
      return {
        args,
        tool,
        comparing,
        HISTORY_LABELS,
        onUndo: fn(),
        onRedo: fn(),
        TOOLS: [
          { id: 'light', label: 'Light', icon: Lamp },
          { id: 'crop', label: 'Crop', icon: Crop },
          { id: 'erase', label: 'Erase', icon: Eraser }
        ],
        ADD_ITEMS: [
          { id: 'image', label: 'Reference image', icon: ImagePlus },
          { id: 'text', label: 'Text layer', icon: Type }
        ]
      }
    },
    template: `
      <EditorDock :label="args.label">
        <EditorTool
          v-for="item in TOOLS"
          :key="item.id"
          :icon="item.icon"
          :label="item.label"
          :pressed="tool === item.id"
          @click="tool = item.id"
        />
        <EditorMenuButton label="Add" :items="ADD_ITEMS" up />
        <EditorCompareToggle v-model="comparing" />
        <template #history>
          <EditorHistory
            :can-undo="true"
            :can-redo="false"
            :labels="HISTORY_LABELS"
            @undo="onUndo"
            @redo="onRedo"
          />
        </template>
      </EditorDock>
    `
  })
}

/** Once a result is in: switch between views, go back to editing, or rerun. */
export const Result: Story = {
  render: (args) => ({
    components: { EditorDock, EditorResultDock },
    setup() {
      const view = ref<EditorView>('compare')
      return {
        args,
        view,
        onEdit: fn(),
        onAgain: fn(),
        labels: {
          compare: 'Compare',
          result: 'Result',
          original: 'Original',
          edit: 'Edit',
          again: 'Run again'
        }
      }
    },
    template: `
      <EditorDock :label="args.label">
        <EditorResultDock
          v-model:view="view"
          :labels
          @edit="onEdit"
          @again="onAgain"
        />
      </EditorDock>
    `
  })
}
