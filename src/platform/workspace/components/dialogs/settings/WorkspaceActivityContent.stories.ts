import type { Meta, StoryObj } from '@storybook/vue3-vite'

import { activityFixture } from '@/platform/workspace/fixtures/activityFixtures'

import WorkspaceActivityContent from './WorkspaceActivityContent.vue'

// The Activity tab renders inside a flex, height-constrained dialog panel and
// auto-sizes its page to the available height; the decorator reproduces that
// container (and the @container query context the footer/tabs rely on).
const meta: Meta<typeof WorkspaceActivityContent> = {
  title: 'Platform/Workspace/WorkspaceActivityContent',
  component: WorkspaceActivityContent,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  decorators: [
    () => ({
      template:
        '<div class="@container flex h-[520px] flex-col p-6"><story /></div>'
    })
  ],
  args: { search: '' }
}

export default meta
type Story = StoryObj<typeof meta>

export const Populated: Story = {
  args: { events: activityFixture }
}

export const Empty: Story = {
  args: { events: [] }
}

export const Searched: Story = {
  args: { events: activityFixture, search: 'partner' }
}
