import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import ProgressToastItem from '@/components/toast/ProgressToastItem.vue'
import Button from '@/components/ui/button/Button.vue'
import type { AssetDownload } from '@/stores/assetDownloadStore'
import { cn } from '@comfyorg/tailwind-utils'

import ToastDock from './ToastDock.vue'
import ToastPanel from './ToastPanel.vue'

interface PanelStoryArgs {
  expanded: boolean
  jobs: AssetDownload[]
  status: string
  statusIcon: string
}

function createMockJob(overrides: Partial<AssetDownload> = {}): AssetDownload {
  return {
    assetId: 'asset-1',
    assetName: 'model-v1.safetensors',
    bytesDownloaded: 0,
    bytesTotal: 1000000,
    lastUpdate: Date.now(),
    progress: 0,
    status: 'created',
    taskId: 'task-1',
    ...overrides
  }
}

const meta: Meta<PanelStoryArgs> = {
  title: 'Components/Toast/ToastPanel',
  parameters: { layout: 'fullscreen' },
  argTypes: { expanded: { control: 'boolean' } },
  render: (args) => ({
    components: { Button, ProgressToastItem, ToastDock, ToastPanel },
    setup() {
      return { args, cn, isExpanded: ref(args.expanded) }
    },
    template: `
      <ToastDock>
        <ToastPanel v-model:expanded="isExpanded" visible>
          <div class="flex h-12 items-center border-b border-border-default px-4">
            <h3 class="text-sm font-bold text-base-foreground">Download Queue</h3>
          </div>
          <div class="flex max-h-75 flex-col gap-2 overflow-y-auto p-4">
            <ProgressToastItem v-for="job in args.jobs" :key="job.taskId" :job="job" />
          </div>
          <template #footer="{ toggle }">
            <div class="flex h-12 items-center justify-between gap-2 border-t border-border-default px-4 text-sm">
              <i :class="cn('size-4', args.statusIcon)" />
              <span class="font-bold text-base-foreground">{{ args.status }}</span>
              <Button variant="muted-textonly" size="icon" @click.stop="toggle">
                <i :class="cn('size-4', isExpanded ? 'icon-[lucide--chevron-down]' : 'icon-[lucide--chevron-up]')" />
              </Button>
            </div>
          </template>
        </ToastPanel>
      </ToastDock>
    `
  })
}

export default meta
type Story = StoryObj<typeof meta>

export const InProgress: Story = {
  args: {
    expanded: false,
    jobs: [
      createMockJob({ progress: 1, status: 'completed' }),
      createMockJob({
        assetName: 'lora-style.safetensors',
        progress: 0.45,
        status: 'running',
        taskId: 'task-2'
      }),
      createMockJob({ assetName: 'vae-decoder.safetensors', taskId: 'task-3' })
    ],
    status: 'lora-style.safetensors',
    statusIcon:
      'icon-[lucide--loader-circle] motion-safe:animate-spin text-muted-foreground'
  }
}

export const Completed: Story = {
  args: {
    expanded: false,
    jobs: [
      createMockJob({
        bytesDownloaded: 1000000,
        progress: 1,
        status: 'completed'
      })
    ],
    status: 'All downloads completed',
    statusIcon: 'icon-[lucide--check-circle] text-jade-600'
  }
}

export const WithError: Story = {
  args: {
    expanded: true,
    jobs: [createMockJob({ progress: 0.23, status: 'failed' })],
    status: '1 download failed',
    statusIcon: 'icon-[lucide--circle-alert] text-destructive-background'
  }
}
