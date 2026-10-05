import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import ProgressToastItem from '@/components/toast/ProgressToastItem.vue'
import Button from '@/components/ui/button/Button.vue'
import type { AssetDownload } from '@/stores/assetDownloadStore'
import { cn } from '@comfyorg/tailwind-utils'

import ToastPanel from './ToastPanel.vue'

function createMockJob(overrides: Partial<AssetDownload> = {}): AssetDownload {
  return {
    taskId: 'task-1',
    assetId: 'asset-1',
    assetName: 'model-v1.safetensors',
    bytesTotal: 1000000,
    bytesDownloaded: 0,
    progress: 0,
    status: 'created',
    lastUpdate: Date.now(),
    ...overrides
  }
}

const meta: Meta<typeof ToastPanel> = {
  title: 'Components/Toast/ToastPanel',
  component: ToastPanel,
  parameters: {
    layout: 'fullscreen'
  },
  decorators: [
    () => ({
      template:
        '<div class="flex h-screen items-end justify-center bg-base-background p-8"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => ({
    components: { ToastPanel, Button, ProgressToastItem },
    setup() {
      const isExpanded = ref(false)
      const jobs = [
        createMockJob({
          taskId: 'task-1',
          assetName: 'model-v1.safetensors',
          status: 'completed',
          progress: 1
        }),
        createMockJob({
          taskId: 'task-2',
          assetName: 'lora-style.safetensors',
          status: 'running',
          progress: 0.45
        }),
        createMockJob({
          taskId: 'task-3',
          assetName: 'vae-decoder.safetensors',
          status: 'created'
        })
      ]
      return { isExpanded, cn, jobs }
    },
    template: `
      <ToastPanel v-model:expanded="isExpanded">
        <template #default>
          <div class="flex h-12 items-center justify-between border-b border-border-default px-4">
            <h3 class="text-sm font-bold text-base-foreground">Download Queue</h3>
          </div>
          <div class="relative max-h-[300px] overflow-y-auto px-4 py-4">
            <div class="flex flex-col gap-2">
              <ProgressToastItem v-for="job in jobs" :key="job.taskId" :job="job" />
            </div>
          </div>
        </template>
        
        <template #footer="{ toggle }">
          <div class="flex h-12 items-center justify-between border-t border-border-default px-4">
            <div class="flex items-center gap-2 text-sm">
              <i class="icon-[lucide--loader-circle] size-4 animate-spin text-muted-foreground" />
              <span class="font-bold text-base-foreground">lora-style.safetensors</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-sm text-muted-foreground">1 of 3</span>
              <div class="flex items-center">
                <Button variant="muted-textonly" size="icon" @click.stop="toggle">
                  <i :class="cn('size-4', isExpanded ? 'icon-[lucide--chevron-down]' : 'icon-[lucide--chevron-up]')" />
                </Button>
              </div>
            </div>
          </div>
        </template>
      </ToastPanel>
    `
  })
}

export const Expanded: Story = {
  render: () => ({
    components: { ToastPanel, Button, ProgressToastItem },
    setup() {
      const isExpanded = ref(true)
      const jobs = [
        createMockJob({
          taskId: 'task-1',
          assetName: 'model-v1.safetensors',
          status: 'completed',
          progress: 1
        }),
        createMockJob({
          taskId: 'task-2',
          assetName: 'lora-style.safetensors',
          status: 'running',
          progress: 0.45
        }),
        createMockJob({
          taskId: 'task-3',
          assetName: 'vae-decoder.safetensors',
          status: 'created'
        })
      ]
      return { isExpanded, cn, jobs }
    },
    template: `
      <ToastPanel v-model:expanded="isExpanded">
        <template #default>
          <div class="flex h-12 items-center justify-between border-b border-border-default px-4">
            <h3 class="text-sm font-bold text-base-foreground">Download Queue</h3>
          </div>
          <div class="relative max-h-[300px] overflow-y-auto px-4 py-4">
            <div class="flex flex-col gap-2">
              <ProgressToastItem v-for="job in jobs" :key="job.taskId" :job="job" />
            </div>
          </div>
        </template>
        
        <template #footer="{ toggle }">
          <div class="flex h-12 items-center justify-between border-t border-border-default px-4">
            <div class="flex items-center gap-2 text-sm">
              <i class="icon-[lucide--loader-circle] size-4 animate-spin text-muted-foreground" />
              <span class="font-bold text-base-foreground">lora-style.safetensors</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-sm text-muted-foreground">1 of 3</span>
              <div class="flex items-center">
                <Button variant="muted-textonly" size="icon" @click.stop="toggle">
                  <i :class="cn('size-4', isExpanded ? 'icon-[lucide--chevron-down]' : 'icon-[lucide--chevron-up]')" />
                </Button>
              </div>
            </div>
          </div>
        </template>
      </ToastPanel>
    `
  })
}

export const Completed: Story = {
  render: () => ({
    components: { ToastPanel, Button, ProgressToastItem },
    setup() {
      const isExpanded = ref(false)
      const jobs = [
        createMockJob({
          taskId: 'task-1',
          assetName: 'model-v1.safetensors',
          bytesDownloaded: 1000000,
          progress: 1,
          status: 'completed'
        }),
        createMockJob({
          taskId: 'task-2',
          assetId: 'asset-2',
          assetName: 'lora-style.safetensors',
          bytesTotal: 500000,
          bytesDownloaded: 500000,
          progress: 1,
          status: 'completed'
        })
      ]
      return { isExpanded, cn, jobs }
    },
    template: `
      <ToastPanel v-model:expanded="isExpanded">
        <template #default>
          <div class="flex h-12 items-center justify-between border-b border-border-default px-4">
            <h3 class="text-sm font-bold text-base-foreground">Download Queue</h3>
          </div>
          <div class="relative max-h-[300px] overflow-y-auto px-4 py-4">
            <div class="flex flex-col gap-2">
              <ProgressToastItem v-for="job in jobs" :key="job.taskId" :job="job" />
            </div>
          </div>
        </template>
        
        <template #footer="{ toggle }">
          <div class="flex h-12 items-center justify-between border-t border-border-default px-4">
            <div class="flex items-center gap-2 text-sm">
              <i class="icon-[lucide--check-circle] size-4 text-jade-600" />
              <span class="font-bold text-base-foreground">All downloads completed</span>
            </div>
            <div class="flex items-center">
              <Button variant="muted-textonly" size="icon" @click.stop="toggle">
                <i :class="cn('size-4', isExpanded ? 'icon-[lucide--chevron-down]' : 'icon-[lucide--chevron-up]')" />
              </Button>
              <Button variant="muted-textonly" size="icon">
                <i class="icon-[lucide--x] size-4" />
              </Button>
            </div>
          </div>
        </template>
      </ToastPanel>
    `
  })
}

export const WithError: Story = {
  render: () => ({
    components: { ToastPanel, Button, ProgressToastItem },
    setup() {
      const isExpanded = ref(true)
      const jobs = [
        createMockJob({
          taskId: 'task-1',
          assetName: 'model-v1.safetensors',
          status: 'failed',
          progress: 0.23
        }),
        createMockJob({
          taskId: 'task-2',
          assetName: 'lora-style.safetensors',
          status: 'completed',
          progress: 1
        })
      ]
      return { isExpanded, cn, jobs }
    },
    template: `
      <ToastPanel v-model:expanded="isExpanded">
        <template #default>
          <div class="flex h-12 items-center justify-between border-b border-border-default px-4">
            <h3 class="text-sm font-bold text-base-foreground">Download Queue</h3>
          </div>
          <div class="relative max-h-[300px] overflow-y-auto px-4 py-4">
            <div class="flex flex-col gap-2">
              <ProgressToastItem v-for="job in jobs" :key="job.taskId" :job="job" />
            </div>
          </div>
        </template>
        
        <template #footer="{ toggle }">
          <div class="flex h-12 items-center justify-between border-t border-border-default px-4">
            <div class="flex items-center gap-2 text-sm">
              <i class="icon-[lucide--circle-alert] size-4 text-destructive-background" />
              <span class="font-bold text-base-foreground">1 download failed</span>
            </div>
            <div class="flex items-center">
              <Button variant="muted-textonly" size="icon" @click.stop="toggle">
                <i :class="cn('size-4', isExpanded ? 'icon-[lucide--chevron-down]' : 'icon-[lucide--chevron-up]')" />
              </Button>
              <Button variant="muted-textonly" size="icon">
                <i class="icon-[lucide--x] size-4" />
              </Button>
            </div>
          </div>
        </template>
      </ToastPanel>
    `
  })
}
