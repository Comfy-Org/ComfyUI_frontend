import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import Tabs from './Tabs.vue'
import TabsContent from './TabsContent.vue'
import TabsList from './TabsList.vue'
import TabsTrigger from './TabsTrigger.vue'

const meta = {
  title: 'Components/Tabs',
  component: Tabs,
  tags: ['autodocs'],
  argTypes: {
    activationMode: {
      control: 'inline-radio',
      options: ['automatic', 'manual']
    },
    'onUpdate:modelValue': { action: 'update:modelValue' }
  }
} satisfies Meta<typeof Tabs>

export default meta
type Story = StoryObj<typeof meta>

function renderTabs({
  disabled = false,
  variant = 'default'
}: { disabled?: boolean; variant?: 'default' | 'panel' | 'flush' } = {}) {
  function render(args: { activationMode?: 'automatic' | 'manual' }) {
    return {
      components: { Tabs, TabsList, TabsTrigger, TabsContent },
      setup() {
        const value = ref('parameters')
        return { args, value, disabled, variant }
      },
      template: `
        <Tabs v-model="value" :activation-mode="args.activationMode" class="w-80">
          <TabsList :variant>
            <TabsTrigger value="parameters" :variant>Parameters</TabsTrigger>
            <TabsTrigger value="info" :variant :disabled="disabled">Info</TabsTrigger>
            <TabsTrigger value="settings" :variant>Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="parameters" class="text-sm text-muted-foreground">
            Adjust the node parameters.
          </TabsContent>
          <TabsContent value="info" class="text-sm text-muted-foreground">
            Read about the node.
          </TabsContent>
          <TabsContent value="settings" class="text-sm text-muted-foreground">
            Configure how the node behaves.
          </TabsContent>
        </Tabs>
      `
    }
  }

  return render
}

export const Default: Story = {
  render: renderTabs()
}

export const ManualActivation: Story = {
  render: renderTabs(),
  args: { activationMode: 'manual' }
}

export const Disabled: Story = {
  render: renderTabs({ disabled: true })
}

export const Panel: Story = {
  render: renderTabs({ variant: 'panel' })
}

export const Flush: Story = {
  render: renderTabs({ variant: 'flush' })
}
