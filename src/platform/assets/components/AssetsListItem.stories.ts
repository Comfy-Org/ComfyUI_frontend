import type { Meta, StoryObj } from '@storybook/vue3-vite'

import Button from '@/components/ui/button/Button.vue'
import AssetsListItem from '@/platform/assets/components/AssetsListItem.vue'

const meta: Meta<typeof AssetsListItem> = {
  title: 'Platform/Assets/AssetsListItem',
  component: AssetsListItem,
  parameters: {
    layout: 'centered'
  },
  decorators: [
    () => ({
      template: '<div class="p-8 bg-base-background"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>
type AssetsListItemProps = InstanceType<typeof AssetsListItem>['$props']

function renderActiveJob(args: AssetsListItemProps) {
  return {
    components: { Button, AssetsListItem },
    setup() {
      return { args }
    },
    template: `
      <AssetsListItem v-bind="args">
        <template #primary>
          <div class="flex items-center gap-1 text-text-primary">
            <span>Total:</span>
            <span class="font-medium">30%</span>
          </div>
        </template>
        <template #secondary>
          <div class="flex items-center gap-1 text-text-secondary">
            <span>CLIP Text Encode:</span>
            <span>70%</span>
          </div>
        </template>
        <template #actions>
          <Button variant="destructive" size="icon" aria-label="Cancel">
            <i class="icon-[lucide--x] size-4" />
          </Button>
        </template>
      </AssetsListItem>
    `
  }
}

function renderGeneratedAsset(args: AssetsListItemProps) {
  return {
    components: { AssetsListItem },
    setup() {
      return { args }
    },
    template: `
      <AssetsListItem v-bind="args">
        <template #secondary>
          <div class="flex items-center gap-2 text-text-secondary">
            <span>1m 56s</span>
            <span>512x512</span>
          </div>
        </template>
      </AssetsListItem>
    `
  }
}

export const ActiveJob: Story = {
  args: {
    previewUrl: '/assets/images/comfy-logo-single.svg',
    previewAlt: 'Job preview',
    progressTotalPercent: 30,
    progressCurrentPercent: 70
  },
  render: renderActiveJob
}

export const FailedJob: Story = {
  args: {
    iconName: 'icon-[lucide--circle-alert]',
    iconClass: 'text-destructive-background',
    iconWrapperClass: 'bg-modal-card-placeholder-background',
    primaryText: 'Failed',
    secondaryText: '8:59:30pm'
  }
}

export const GeneratedAsset: Story = {
  args: {
    previewUrl: '/assets/images/comfy-logo-single.svg',
    previewAlt: 'image03.png',
    primaryText: 'image03.png'
  },
  render: renderGeneratedAsset
}
