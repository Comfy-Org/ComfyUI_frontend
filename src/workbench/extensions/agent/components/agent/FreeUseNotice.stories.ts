import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { fn } from 'storybook/test'

import '../../agentPanel.css'

import FreeUseNotice from './FreeUseNotice.vue'
import { FREE_USE_NOTICE_DISMISSED_KEY } from './freeUseNoticeDismissal'

// The notice hides itself for good once dismissed, and the flag is shared
// localStorage rather than a prop. Clearing it per story keeps a dismissal in
// one story from blanking every later snapshot. The key is scoped per account,
// so clear the prefix rather than one exact key.
function withFreshDismissal() {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(FREE_USE_NOTICE_DISMISSED_KEY)) {
      localStorage.removeItem(key)
    }
  }
  return {
    template:
      '<div class="agent-scope w-[388px] bg-base-background"><story /></div>'
  }
}

const meta: Meta<typeof FreeUseNotice> = {
  title: 'Agent/FreeUseNotice',
  component: FreeUseNotice,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  globals: { theme: 'dark' },
  args: { placement: 'top-banner', onNotice: fn() },
  // DES-1221 cells b–e differ only in this prop, so the Controls panel walks
  // the arms and the URL links any one of them.
  argTypes: {
    placement: {
      control: 'select',
      options: ['top-banner', 'near-composer', 'above-input', 'inside-input']
    }
  },
  decorators: [withFreshDismissal]
}

export default meta
type Story = StoryObj<typeof meta>

/** Cell b: full-bleed under the panel header. */
export const Default: Story = {}

/** Cell e: inset inside the input box, which supplies its own container. */
export const InsideInput: Story = {
  args: { placement: 'inside-input' },
  decorators: [
    () => ({
      template:
        '<div class="rounded-lg border border-border-subtle bg-secondary-background"><story /></div>'
    })
  ]
}

// The notice is a translucent blue over whatever sits behind it, so the copy
// and the link both have to stay legible when base-background flips. Theme is
// a toolbar global, but only story exports are snapshotted, so light needs an
// export to get visual coverage at all — as in RunNoticeBanner and
// AgentConsentCard beside it.
export const DefaultLight: Story = {
  globals: { theme: 'light' }
}

export const InsideInputLight: Story = {
  ...InsideInput,
  globals: { theme: 'light' }
}
