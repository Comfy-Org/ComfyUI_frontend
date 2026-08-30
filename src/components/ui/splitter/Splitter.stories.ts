import type { Meta, StoryObj } from '@storybook/vue3-vite'

import { SplitterGroup, SplitterPanel, SplitterResizeHandle } from '.'

const meta = {
  title: 'Components/Splitter',
  component: SplitterGroup,
  tags: ['autodocs']
} satisfies Meta<typeof SplitterGroup>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => ({
    components: { SplitterGroup, SplitterPanel, SplitterResizeHandle },
    template: `
      <SplitterGroup class="h-64 rounded-lg border border-border-default">
        <SplitterPanel :default-size="30" class="p-4">Sidebar</SplitterPanel>
        <SplitterResizeHandle />
        <SplitterPanel :default-size="70" class="p-4">Content</SplitterPanel>
      </SplitterGroup>
    `
  })
}
