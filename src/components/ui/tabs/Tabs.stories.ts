import type { Meta, StoryObj } from '@storybook/vue3-vite'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '.'

const meta = {
  title: 'Components/Tabs',
  component: Tabs,
  tags: ['autodocs']
} satisfies Meta<typeof Tabs>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => ({
    components: { Tabs, TabsContent, TabsList, TabsTrigger },
    template: `
      <Tabs default-value="account" class="w-96">
        <TabsList class="gap-1 border-b border-border-default">
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>
        <TabsContent value="account" class="p-4">Account settings</TabsContent>
        <TabsContent value="security" class="p-4">Security settings</TabsContent>
      </Tabs>
    `
  })
}
