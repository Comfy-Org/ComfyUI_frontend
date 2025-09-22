import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import EditableText from './EditableText.vue'

const meta: Meta<typeof EditableText> = {
  title: 'Components/Common/EditableText',
  component: EditableText,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'EditableText allows inline text editing with sophisticated focus management and keyboard handling. It supports automatic text selection, smart filename handling (excluding extensions), and seamless transitions between view and edit modes.'
      }
    }
  },
  argTypes: {
    modelValue: {
      control: 'text',
      description: 'The text value to display and edit'
    },
    isEditing: {
      control: 'boolean',
      description: 'Whether the component is currently in edit mode'
    }
  },
  tags: ['autodocs']
}

export default meta
type Story = StoryObj<typeof EditableText>

const createEditableStoryRender =
  (
    initialText = 'Click to edit this text',
    initialEditing = false,
    stayEditing = false
  ) =>
  (args: any) => ({
    components: { EditableText },
    setup() {
      const text = ref(args.modelValue || initialText)
      const editing = ref(args.isEditing ?? initialEditing)
      const actions = ref<string[]>([])

      const logAction = (action: string, data?: any) => {
        const timestamp = new Date().toLocaleTimeString()
        const message = data
          ? `${action}: "${data}" (${timestamp})`
          : `${action} (${timestamp})`
        actions.value.unshift(message)
        if (actions.value.length > 5) actions.value.pop()
        console.log(action, data)
      }

      const handleEdit = (newValue: string) => {
        logAction('Edit completed', newValue)
        text.value = newValue
        editing.value = stayEditing // Stay in edit mode if specified
      }

      const startEdit = () => {
        editing.value = true
        logAction('Edit started')
      }

      return { args, text, editing, actions, handleEdit, startEdit }
    },
    template: `
    <div style="padding: 20px;">
      <div @click="startEdit" style="cursor: pointer; border: 2px dashed #ccc; border-radius: 4px; padding: 20px;">
        <div style="margin-bottom: 8px; font-size: 12px; color: #666;">Click text to edit:</div>
        <EditableText
          :modelValue="text"
          :isEditing="editing"
          @edit="handleEdit"
        />
      </div>
      <div v-if="actions.length > 0" style="margin-top: 16px; padding: 12px; background: #f5f5f5; border-radius: 4px; font-family: monospace; font-size: 12px;">
        <div style="font-weight: bold; margin-bottom: 8px;">Actions Log:</div>
        <div v-for="action in actions" :key="action" style="margin: 2px 0;">{{ action }}</div>
      </div>
    </div>
  `
  })

export const Default: Story = {
  render: createEditableStoryRender(),
  args: {
    modelValue: 'Click to edit this text',
    isEditing: false
  }
}

export const AlwaysEditing: Story = {
  render: createEditableStoryRender('Always in edit mode', true, true),
  args: {
    modelValue: 'Always in edit mode',
    isEditing: true
  }
}

export const FilenameEditing: Story = {
  render: () => ({
    components: { EditableText },
    setup() {
      const filenames = ref([
        'my_workflow.json',
        'image_processing.png',
        'model_config.yaml',
        'final_render.mp4'
      ])
      const actions = ref<string[]>([])

      const logAction = (action: string, filename: string, newName: string) => {
        const timestamp = new Date().toLocaleTimeString()
        actions.value.unshift(
          `${action}: "${filename}" → "${newName}" (${timestamp})`
        )
        if (actions.value.length > 5) actions.value.pop()
        console.log(action, { filename, newName })
      }

      const handleFilenameEdit = (index: number, newValue: string) => {
        const oldName = filenames.value[index]
        filenames.value[index] = newValue
        logAction('Filename changed', oldName, newValue)
      }

      return { filenames, actions, handleFilenameEdit }
    },
    template: `
      <div style="padding: 20px;">
        <div style="margin-bottom: 16px; font-weight: bold;">File Browser (click filenames to edit):</div>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <div v-for="(filename, index) in filenames" :key="index" 
               style="display: flex; align-items: center; padding: 8px; background: #f9f9f9; border-radius: 4px;">
            <i style="margin-right: 8px; color: #666;" class="pi pi-file"></i>
            <EditableText
              :modelValue="filename"
              :isEditing="false"
              @edit="(newValue) => handleFilenameEdit(index, newValue)"
            />
          </div>
        </div>
        <div v-if="actions.length > 0" style="margin-top: 16px; padding: 12px; background: #f5f5f5; border-radius: 4px; font-family: monospace; font-size: 12px;">
          <div style="font-weight: bold; margin-bottom: 8px;">Actions Log:</div>
          <div v-for="action in actions" :key="action" style="margin: 2px 0;">{{ action }}</div>
        </div>
      </div>
    `
  })
}

export const LongText: Story = {
  render: createEditableStoryRender(
    'This is a much longer text that demonstrates how the EditableText component handles longer content with multiple words and potentially line wrapping scenarios.'
  ),
  args: {
    modelValue:
      'This is a much longer text that demonstrates how the EditableText component handles longer content.',
    isEditing: false
  }
}

export const EmptyState: Story = {
  render: createEditableStoryRender(''),
  args: {
    modelValue: '',
    isEditing: false
  }
}

export const SingleCharacter: Story = {
  render: createEditableStoryRender('A'),
  args: {
    modelValue: 'A',
    isEditing: false
  }
}

// ComfyUI usage examples
export const WorkflowNaming: Story = {
  render: () => ({
    components: { EditableText },
    setup() {
      const workflows = ref([
        'Portrait Enhancement',
        'Landscape Generation',
        'Style Transfer Workflow',
        'Untitled Workflow'
      ])

      const handleWorkflowRename = (index: number, newName: string) => {
        workflows.value[index] = newName
        console.log('Workflow renamed:', { index, newName })
      }

      return { workflows, handleWorkflowRename }
    },
    template: `
      <div style="padding: 20px; width: 300px;">
        <div style="margin-bottom: 16px; font-weight: bold;">Workflow Library</div>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div v-for="(workflow, index) in workflows" :key="index" 
               style="padding: 12px; border: 1px solid #ddd; border-radius: 6px; background: white;">
            <EditableText
              :modelValue="workflow"
              :isEditing="false"
              @edit="(newName) => handleWorkflowRename(index, newName)"
              style="font-size: 14px; font-weight: 500;"
            />
            <div style="margin-top: 4px; font-size: 11px; color: #666;">
              Last modified: 2 hours ago
            </div>
          </div>
        </div>
      </div>
    `
  })
}

export const ModelRenaming: Story = {
  render: () => ({
    components: { EditableText },
    setup() {
      const models = ref([
        'stable-diffusion-v1-5.safetensors',
        'controlnet_depth.pth',
        'vae-ft-mse-840000-ema.ckpt'
      ])

      const handleModelRename = (index: number, newName: string) => {
        models.value[index] = newName
        console.log('Model renamed:', { index, newName })
      }

      return { models, handleModelRename }
    },
    template: `
      <div style="padding: 20px; width: 350px;">
        <div style="margin-bottom: 16px; font-weight: bold;">Model Manager</div>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <div v-for="(model, index) in models" :key="index" 
               style="display: flex; align-items: center; padding: 8px; background: #f8f8f8; border-radius: 4px;">
            <i style="margin-right: 8px; color: #4a90e2;" class="pi pi-box"></i>
            <EditableText
              :modelValue="model"
              :isEditing="false"
              @edit="(newName) => handleModelRename(index, newName)"
              style="flex: 1; font-family: 'JetBrains Mono', monospace; font-size: 12px;"
            />
          </div>
        </div>
      </div>
    `
  })
}
