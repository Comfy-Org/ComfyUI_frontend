import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { fn } from 'storybook/test'

import '@/workbench/extensions/agent/agentPanel.css'

import FreeUseNotice from './FreeUseNotice.vue'
import { FREE_USE_NOTICE_DISMISSED_KEY } from './freeUseNoticeDismissal'

function clearFreeUseNoticeDismissals() {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(FREE_USE_NOTICE_DISMISSED_KEY)) {
      localStorage.removeItem(key)
    }
  }
  return {
    template: '<div class="agent-scope w-[388px] bg-background"><story /></div>'
  }
}

const meta: Meta<typeof FreeUseNotice> = {
  title: 'Agent/FreeUseNotice',
  component: FreeUseNotice,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  globals: { theme: 'dark' },
  args: { onNotice: fn() },
  decorators: [clearFreeUseNoticeDismissals]
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

// The notice is a translucent blue over whatever sits behind it, so the copy
// and the link both have to stay legible when base-background flips. Theme is
// a toolbar global, but only story exports are snapshotted, so light needs an
// export to get visual coverage at all — as in RunNoticeBanner and
// AgentConsentCard beside it.
export const DefaultLight: Story = {
  globals: { theme: 'light' }
}
