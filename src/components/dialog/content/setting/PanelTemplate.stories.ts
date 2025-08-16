import type { Meta, StoryObj } from '@storybook/vue3-vite'

import PanelTemplate from './PanelTemplate.vue'

const meta: Meta<typeof PanelTemplate> = {
  title: 'Components/Setting/PanelTemplate',
  component: PanelTemplate,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A template component for settings panels that provides consistent layout with header, content, and footer slots.'
      }
    }
  },
  argTypes: {
    value: {
      control: 'text',
      description: 'The value identifier for the tab panel'
    },
    class: {
      control: 'text',
      description: 'Additional CSS classes to apply'
    }
  },
  decorators: [
    () => ({
      template:
        '<div style="width: 600px; height: 400px; border: 1px solid #ddd;"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    value: 'example-panel'
  },
  render: (args) => ({
    components: { PanelTemplate },
    setup() {
      return { args }
    },
    template: `
      <PanelTemplate v-bind="args">
        <div class="p-4">
          <h3 class="text-lg font-semibold mb-4">Panel Content</h3>
          <p class="mb-4">This is the main content area of the panel.</p>
          <div class="space-y-2">
            <div class="p-2 bg-gray-100 rounded">Setting Item 1</div>
            <div class="p-2 bg-gray-100 rounded">Setting Item 2</div>
            <div class="p-2 bg-gray-100 rounded">Setting Item 3</div>
          </div>
        </div>
      </PanelTemplate>
    `
  })
}

export const WithHeader: Story = {
  args: {
    value: 'header-panel'
  },
  render: (args) => ({
    components: { PanelTemplate },
    setup() {
      return { args }
    },
    template: `
      <PanelTemplate v-bind="args">
        <template #header>
          <div class="p-3 bg-blue-50 border border-blue-200 rounded mb-4">
            <h4 class="text-blue-800 font-medium">Panel Header</h4>
            <p class="text-blue-600 text-sm">This is a header message for the panel.</p>
          </div>
        </template>
        <div class="p-4">
          <h3 class="text-lg font-semibold mb-4">Panel Content</h3>
          <p>Content with a header message above.</p>
        </div>
      </PanelTemplate>
    `
  })
}

export const WithFooter: Story = {
  args: {
    value: 'footer-panel'
  },
  render: (args) => ({
    components: { PanelTemplate },
    setup() {
      return { args }
    },
    template: `
      <PanelTemplate v-bind="args">
        <div class="p-4">
          <h3 class="text-lg font-semibold mb-4">Panel Content</h3>
          <p>Content with a footer below.</p>
        </div>
        <template #footer>
          <div class="p-3 bg-gray-50 border-t">
            <div class="flex justify-end space-x-2">
              <button class="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">
                Cancel
              </button>
              <button class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                Save
              </button>
            </div>
          </div>
        </template>
      </PanelTemplate>
    `
  })
}

export const WithHeaderAndFooter: Story = {
  args: {
    value: 'full-panel'
  },
  render: (args) => ({
    components: { PanelTemplate },
    setup() {
      return { args }
    },
    template: `
      <PanelTemplate v-bind="args">
        <template #header>
          <div class="p-3 bg-green-50 border border-green-200 rounded mb-4">
            <h4 class="text-green-800 font-medium">Important Notice</h4>
            <p class="text-green-600 text-sm">Please review all settings before saving.</p>
          </div>
        </template>
        <div class="p-4">
          <h3 class="text-lg font-semibold mb-4">Settings Content</h3>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium mb-1">Setting 1</label>
              <input type="text" class="w-full p-2 border rounded" value="Default value" />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Setting 2</label>
              <select class="w-full p-2 border rounded">
                <option>Option 1</option>
                <option>Option 2</option>
              </select>
            </div>
          </div>
        </div>
        <template #footer>
          <div class="p-3 bg-gray-50 border-t">
            <div class="flex justify-between items-center">
              <span class="text-sm text-gray-600">Changes will be saved automatically</span>
              <button class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                Apply Changes
              </button>
            </div>
          </div>
        </template>
      </PanelTemplate>
    `
  })
}

export const LongContent: Story = {
  args: {
    value: 'long-panel'
  },
  render: (args) => ({
    components: { PanelTemplate },
    setup() {
      return { args }
    },
    template: `
      <PanelTemplate v-bind="args">
        <div class="p-4">
          <h3 class="text-lg font-semibold mb-4">Scrollable Content</h3>
          <div class="space-y-4">
            ${Array.from(
              { length: 20 },
              (_, i) => `
              <div class="p-3 bg-gray-100 rounded">
                <h4 class="font-medium">Setting Group ${i + 1}</h4>
                <p class="text-sm text-gray-600">This is setting group ${i + 1} with some description text.</p>
              </div>
            `
            ).join('')}
          </div>
        </div>
      </PanelTemplate>
    `
  })
}
