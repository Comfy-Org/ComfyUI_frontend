import type { Meta, StoryObj } from '@storybook/vue3-vite'

import Button from '@/components/ui/button/Button.vue'
import { iconForJobState } from '@/utils/queueDisplay'

import AssetsListItem from './AssetsListItem.vue'

function centeredDecorator() {
  return {
    template: `
          <div style="width: 380px;">
            <story />
          </div>
      `
  }
}

const meta: Meta<typeof AssetsListItem> = {
  title: 'Platform/Assets/AssetsListItem',
  component: AssetsListItem,
  parameters: {
    layout: 'centered'
  },
  decorators: [centeredDecorator]
}

export default meta
type Story = StoryObj<typeof meta>

const IMAGE_PREVIEW = '/assets/images/comfy-logo-single.svg'
const VIDEO_PREVIEW = '/assets/images/default-template.png'

export const PendingJob: Story = {
  args: {
    iconName: iconForJobState('pending'),
    iconClass: 'animate-spin',
    primaryText: 'In queue',
    secondaryText: '8:59:30pm'
  }
}

export const InitializationJob: Story = {
  args: {
    iconName: iconForJobState('initialization'),
    primaryText: 'Initializing...',
    secondaryText: '8:59:35pm'
  }
}

export const RunningJob: Story = {
  args: {
    iconName: iconForJobState('running'),
    primaryText: 'Total: 30%',
    secondaryText: 'CLIP Text Encode: 70%',
    progressTotalPercent: 30,
    progressCurrentPercent: 70
  }
}

export const RunningJobWithActions: Story = {
  args: {
    iconName: iconForJobState('running'),
    primaryText: 'Total: 30%',
    secondaryText: 'KSampler: 70%',
    progressTotalPercent: 30,
    progressCurrentPercent: 70
  },
  render: renderRunningJobWithActions
}

export const FailedJob: Story = {
  args: {
    iconName: iconForJobState('failed'),
    iconClass: 'text-destructive-background',
    iconWrapperClass: 'bg-modal-card-placeholder-background',
    primaryText: 'Failed',
    secondaryText: '8:59:30pm'
  }
}

export const GeneratedImage: Story = {
  args: {
    previewUrl: IMAGE_PREVIEW,
    previewAlt: 'image-032.png',
    primaryText: 'image-032.png',
    secondaryText: '1.84s'
  }
}

export const GeneratedVideo: Story = {
  args: {
    previewUrl: VIDEO_PREVIEW,
    previewAlt: 'clip-01.mp4',
    primaryText: 'clip-01.mp4',
    secondaryText: '2m 12s'
  }
}

export const GeneratedAudio: Story = {
  args: {
    iconName: 'icon-[lucide--music]',
    primaryText: 'soundtrack-01.mp3',
    secondaryText: '3m 20s'
  }
}

export const Generated3D: Story = {
  args: {
    iconName: 'icon-[lucide--box]',
    primaryText: 'scene-01.glb',
    secondaryText: '128 MB'
  }
}

type AssetsListItemProps = InstanceType<typeof AssetsListItem>['$props']

function renderRunningJobWithActions(args: AssetsListItemProps) {
  return {
    components: { AssetsListItem, Button },
    setup() {
      return { args }
    },
    template: `
      <AssetsListItem v-bind="args">
        <template #actions>
          <Button variant="destructive" size="icon" aria-label="Cancel">
            <i class="icon-[lucide--x] size-4" />
          </Button>
        </template>
      </AssetsListItem>
    `
  }
}
