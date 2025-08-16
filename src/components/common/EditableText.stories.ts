import type { Meta, StoryObj } from '@storybook/vue3-vite'

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
      description: 'The text value to display and edit',
      defaultValue: 'Editable Text'
    },
    isEditing: {
      control: 'boolean',
      description: 'Whether the component is currently in edit mode',
      defaultValue: false
    },
    onEdit: {
      description: 'Event emitted when editing is finished with the new value'
    }
  },
  tags: ['autodocs']
}

export default meta
type Story = StoryObj<typeof EditableText>

export const Default: Story = {
  render: (args) => ({
    components: { EditableText },
    setup() {
      return { args }
    },
    data() {
      return {
        text: args.modelValue || 'Click to edit this text',
        editing: args.isEditing || false
      }
    },
    methods: {
      handleEdit(newValue: string) {
        console.log('Edit completed:', newValue)
        this.text = newValue
        this.editing = false
      },
      startEdit() {
        this.editing = true
      }
    },
    template: `
      <div @click="startEdit" style="padding: 20px; cursor: pointer; border: 2px dashed #ccc; border-radius: 4px;">
        <div style="margin-bottom: 8px; font-size: 12px; color: #666;">Click text to edit:</div>
        <EditableText
          :modelValue="text"
          :isEditing="editing"
          @edit="handleEdit"
        />
      </div>
    `
  }),
  args: {
    modelValue: 'Click to edit this text',
    isEditing: false
  },
  parameters: {
    docs: {
      description: {
        story:
          'Default editable text - click to start editing, press Enter or blur to finish.'
      }
    }
  }
}

export const AlwaysEditing: Story = {
  render: (args) => ({
    components: { EditableText },
    setup() {
      return { args }
    },
    data() {
      return {
        text: args.modelValue || 'Always in edit mode',
        editing: true
      }
    },
    methods: {
      handleEdit(newValue: string) {
        console.log('Edit completed:', newValue)
        this.text = newValue
        // Stay in edit mode
        this.editing = true
      }
    },
    template: `
      <div style="padding: 20px;">
        <div style="margin-bottom: 8px; font-size: 12px; color: #666;">Always in edit mode:</div>
        <EditableText
          :modelValue="text"
          :isEditing="editing"
          @edit="handleEdit"
        />
      </div>
    `
  }),
  args: {
    modelValue: 'Always in edit mode',
    isEditing: true
  },
  parameters: {
    docs: {
      description: {
        story:
          'EditableText component that stays in edit mode - useful for forms or continuous editing.'
      }
    }
  }
}

export const FilenameEditing: Story = {
  render: () => ({
    components: { EditableText },
    data() {
      return {
        filename: 'my_workflow.json',
        isEditing: false
      }
    },
    methods: {
      handleEdit(newValue: string) {
        console.log('Filename edited:', newValue)
        this.filename = newValue
        this.isEditing = false
      },
      startEdit() {
        this.isEditing = true
      }
    },
    template: `
      <div style="padding: 20px;">
        <div style="margin-bottom: 8px; font-size: 12px; color: #666;">
          Filename editing (automatically selects name without extension):
        </div>
        <div 
          @click="startEdit" 
          style="display: inline-block; cursor: pointer; padding: 8px; background: rgba(0,0,0,0.05); border-radius: 4px;"
        >
          <i class="pi pi-file" style="margin-right: 8px;"></i>
          <EditableText
            :modelValue="filename"
            :isEditing="isEditing"
            @edit="handleEdit"
          />
        </div>
      </div>
    `
  }),
  parameters: {
    docs: {
      description: {
        story:
          'Filename editing example - automatically selects the filename without extension for easier renaming.'
      }
    }
  }
}

export const LongText: Story = {
  render: () => ({
    components: { EditableText },
    data() {
      return {
        longText:
          'This is a very long text that demonstrates how the EditableText component handles lengthy content and text wrapping in both view and edit modes',
        isEditing: false
      }
    },
    methods: {
      handleEdit(newValue: string) {
        console.log('Long text edited:', newValue)
        this.longText = newValue
        this.isEditing = false
      },
      startEdit() {
        this.isEditing = true
      }
    },
    template: `
      <div style="padding: 20px; max-width: 300px;">
        <div style="margin-bottom: 8px; font-size: 12px; color: #666;">Long text handling:</div>
        <div 
          @click="startEdit" 
          style="cursor: pointer; padding: 8px; background: rgba(0,0,0,0.05); border-radius: 4px; word-wrap: break-word;"
        >
          <EditableText
            :modelValue="longText"
            :isEditing="isEditing"
            @edit="handleEdit"
          />
        </div>
      </div>
    `
  }),
  parameters: {
    docs: {
      description: {
        story:
          'Long text example showing how the component handles text wrapping and lengthy content.'
      }
    }
  }
}

export const ComfyUIWorkflowName: Story = {
  render: () => ({
    components: { EditableText },
    data() {
      return {
        workflowName: 'SDXL Portrait Generation',
        isEditing: false
      }
    },
    methods: {
      handleEdit(newValue: string) {
        console.log('Workflow name edited:', newValue)
        this.workflowName = newValue
        this.isEditing = false
      },
      startEdit() {
        this.isEditing = true
      }
    },
    template: `
      <div style="padding: 20px;">
        <div style="margin-bottom: 8px; font-size: 12px; color: #666;">ComfyUI workflow name editing:</div>
        <div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: rgba(0,0,0,0.05); border-radius: 6px;">
          <i class="pi pi-sitemap" style="color: #6366f1;"></i>
          <div style="flex-grow: 1;">
            <div 
              @click="startEdit" 
              style="cursor: pointer; font-weight: 600; color: #1f2937;"
            >
              <EditableText
                :modelValue="workflowName"
                :isEditing="isEditing"
                @edit="handleEdit"
              />
            </div>
            <div style="font-size: 12px; color: #6b7280; margin-top: 2px;">
              Click to rename workflow
            </div>
          </div>
          <button @click="startEdit" style="padding: 4px 8px; background: none; border: 1px solid #d1d5db; border-radius: 4px; cursor: pointer;">
            <i class="pi pi-pencil" style="font-size: 12px;"></i>
          </button>
        </div>
      </div>
    `
  }),
  parameters: {
    docs: {
      description: {
        story:
          'ComfyUI workflow name editing example with realistic UI styling.'
      }
    }
  }
}

export const NodeTitleEditing: Story = {
  render: () => ({
    components: { EditableText },
    data() {
      return {
        nodeTitle: 'KSampler',
        isEditing: false
      }
    },
    methods: {
      handleEdit(newValue: string) {
        console.log('Node title edited:', newValue)
        this.nodeTitle = newValue
        this.isEditing = false
      },
      startEdit() {
        this.isEditing = true
      }
    },
    template: `
      <div style="padding: 20px;">
        <div style="margin-bottom: 8px; font-size: 12px; color: #666;">ComfyUI node title editing:</div>
        <div style="width: 200px; background: #2d3748; color: white; border-radius: 4px; padding: 8px;">
          <div 
            @click="startEdit"
            style="cursor: pointer; font-weight: bold; font-size: 14px; margin-bottom: 4px;"
          >
            <EditableText
              :modelValue="nodeTitle"
              :isEditing="isEditing"
              @edit="handleEdit"
            />
          </div>
          <div style="font-size: 11px; color: #a0aec0;">sampling</div>
          <!-- Mock node inputs/outputs -->
          <div style="margin-top: 8px; font-size: 11px;">
            <div>• model</div>
            <div>• positive</div>
            <div>• negative</div>
            <div>• latent_image</div>
          </div>
        </div>
      </div>
    `
  }),
  parameters: {
    docs: {
      description: {
        story:
          'ComfyUI node title editing example within a realistic node interface.'
      }
    }
  }
}

export const MultipleInstances: Story = {
  render: () => ({
    components: { EditableText },
    data() {
      return {
        items: [
          { id: 1, name: 'Item One', editing: false },
          { id: 2, name: 'Item Two', editing: false },
          { id: 3, name: 'Item Three', editing: false }
        ]
      }
    },
    methods: {
      handleEdit(id: number, newValue: string) {
        console.log(`Item ${id} edited:`, newValue)
        const item = this.items.find((i: any) => i.id === id)
        if (item) {
          item.name = newValue
          item.editing = false
        }
      },
      startEdit(id: number) {
        this.items.forEach((item: any) => {
          item.editing = item.id === id
        })
      }
    },
    template: `
      <div style="padding: 20px;">
        <div style="margin-bottom: 12px; font-size: 12px; color: #666;">Multiple editable text instances:</div>
        <div v-for="item in items" :key="item.id" style="margin-bottom: 8px;">
          <div 
            @click="startEdit(item.id)"
            style="display: flex; align-items: center; gap: 8px; padding: 8px; background: rgba(0,0,0,0.05); border-radius: 4px; cursor: pointer;"
          >
            <span style="font-weight: 600; color: #6b7280; min-width: 20px;">{{ item.id }}.</span>
            <EditableText
              :modelValue="item.name"
              :isEditing="item.editing"
              @edit="(value) => handleEdit(item.id, value)"
            />
          </div>
        </div>
      </div>
    `
  }),
  parameters: {
    docs: {
      description: {
        story:
          'Multiple EditableText instances in a list - demonstrates isolated editing states.'
      }
    }
  }
}

export const KeyboardInteraction: Story = {
  render: () => ({
    components: { EditableText },
    data() {
      return {
        text: 'Press Enter to save, Escape to cancel',
        isEditing: true,
        log: []
      }
    },
    methods: {
      handleEdit(newValue: string) {
        this.log.push(`Edited: "${newValue}"`)
        this.text = newValue
        this.isEditing = false
        setTimeout(() => {
          this.isEditing = true
        }, 1000)
      }
    },
    template: `
      <div style="padding: 20px;">
        <div style="margin-bottom: 12px; font-size: 12px; color: #666;">
          Keyboard interaction demo (auto-restarts editing):
        </div>
        <EditableText
          :modelValue="text"
          :isEditing="isEditing"
          @edit="handleEdit"
        />
        <div style="margin-top: 16px; font-size: 12px; color: #6b7280;">
          <strong>Log:</strong>
          <div v-for="(entry, index) in log" :key="index" style="margin-top: 2px;">
            {{ entry }}
          </div>
        </div>
      </div>
    `
  }),
  parameters: {
    docs: {
      description: {
        story:
          'Keyboard interaction demo - shows editing behavior with automatic restart for testing.'
      }
    }
  }
}

export const EmptyText: Story = {
  render: () => ({
    components: { EditableText },
    data() {
      return {
        text: '',
        isEditing: false
      }
    },
    methods: {
      handleEdit(newValue: string) {
        console.log('Empty text edited:', newValue)
        this.text = newValue
        this.isEditing = false
      },
      startEdit() {
        this.isEditing = true
      }
    },
    template: `
      <div style="padding: 20px;">
        <div style="margin-bottom: 8px; font-size: 12px; color: #666;">Empty text handling:</div>
        <div 
          @click="startEdit" 
          style="cursor: pointer; padding: 8px; background: rgba(0,0,0,0.05); border-radius: 4px; min-height: 20px; min-width: 100px;"
        >
          <EditableText
            :modelValue="text"
            :isEditing="isEditing"
            @edit="handleEdit"
          />
          <span v-if="!text && !isEditing" style="color: #9ca3af; font-style: italic;">
            Click to add text
          </span>
        </div>
      </div>
    `
  }),
  parameters: {
    docs: {
      description: {
        story: 'Empty text handling with placeholder text when no value is set.'
      }
    }
  }
}
