import type { Meta, StoryObj } from '@storybook/vue3-vite'

import '../../agentPanel.css'

import FreeUseNotice from './FreeUseNotice.vue'
import { FREE_USE_NOTICE_DISMISSED_KEY } from './freeUseNoticeDismissal'

// The notice hides itself for good once dismissed, and the flag is shared
// localStorage rather than a prop. Clearing it per story keeps a dismissal in
// one story from blanking every later snapshot.
function withFreshDismissal() {
  localStorage.removeItem(FREE_USE_NOTICE_DISMISSED_KEY)
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
  decorators: [withFreshDismissal]
}

export default meta
type Story = StoryObj<typeof meta>

/** DES-1221 cell b: full-bleed under the panel header. */
export const TopBanner: Story = { args: { placement: 'top-banner' } }

/** Cell c: inset card sitting on the panel background, above the composer. */
export const NearComposer: Story = { args: { placement: 'near-composer' } }

/** Cell d: full width inside the composer, between the tab row and the input. */
export const AboveInput: Story = { args: { placement: 'above-input' } }

/** Cell e: inset inside the input box, above the prompt field. */
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
// and the link both have to stay legible when base-background flips.
export const TopBannerLight: Story = {
  args: { placement: 'top-banner' },
  globals: { theme: 'light' }
}

export const NearComposerLight: Story = {
  args: { placement: 'near-composer' },
  globals: { theme: 'light' }
}
