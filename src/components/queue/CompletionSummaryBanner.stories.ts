import type { Meta, StoryObj } from '@storybook/vue3-vite'

import CompletionSummaryBanner from './CompletionSummaryBanner.vue'

const meta: Meta<typeof CompletionSummaryBanner> = {
  title: 'Queue/CompletionSummaryBanner',
  component: CompletionSummaryBanner,
  parameters: {
    layout: 'padded'
  }
}

export default meta
type Story = StoryObj<typeof meta>

const thumb = (hex: string) =>
  `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'><rect width='24' height='24' fill='%23${hex}'/></svg>`

const thumbs = [thumb('ff6b6b'), thumb('4dabf7'), thumb('51cf66')]

export const AllSuccessSingle: Story = {
  args: {
    mode: 'allSuccess',
    completedCount: 1,
    failedCount: 0,
    thumbnailUrls: [thumbs[0]]
  }
}

export const AllSuccessPlural: Story = {
  args: {
    mode: 'allSuccess',
    completedCount: 3,
    failedCount: 0,
    thumbnailUrls: thumbs
  }
}

export const MixedSingleSingle: Story = {
  args: {
    mode: 'mixed',
    completedCount: 1,
    failedCount: 1,
    thumbnailUrls: thumbs.slice(0, 2)
  }
}

export const MixedPluralPlural: Story = {
  args: {
    mode: 'mixed',
    completedCount: 2,
    failedCount: 3,
    thumbnailUrls: thumbs
  }
}

export const AllFailedSingle: Story = {
  args: {
    mode: 'allFailed',
    completedCount: 0,
    failedCount: 1,
    thumbnailUrls: []
  }
}

export const AllFailedPlural: Story = {
  args: {
    mode: 'allFailed',
    completedCount: 0,
    failedCount: 4,
    thumbnailUrls: []
  }
}
