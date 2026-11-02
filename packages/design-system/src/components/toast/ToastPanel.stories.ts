import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import Button from '@comfyorg/design-system/button/Button'
import { cn } from '@comfyorg/tailwind-utils'

import ToastDock from '@comfyorg/design-system/toast/ToastDock'
import ToastPanel from '@comfyorg/design-system/toast/ToastPanel'

interface StoryJob {
  id: string
  name: string
  progress: number
}

interface PanelStoryArgs {
  expanded: boolean
  jobs: StoryJob[]
  status: string
  statusIcon: string
}

function createMockJob(overrides: Partial<StoryJob> = {}): StoryJob {
  return {
    id: 'task-1',
    name: 'model-v1.safetensors',
    progress: 0,
    ...overrides
  }
}

const meta: Meta<PanelStoryArgs> = {
  title: 'Components/Toast/ToastPanel',
  parameters: { layout: 'fullscreen' },
  argTypes: { expanded: { control: 'boolean' } },
  render: (args) => ({
    components: { Button, ToastDock, ToastPanel },
    setup() {
      return { args, cn, isExpanded: ref(args.expanded) }
    },
    template: `
      <ToastDock>
        <ToastPanel v-model:expanded="isExpanded" visible>
          <div class="flex h-12 items-center border-b border-border px-4">
            <h3 class="text-sm font-bold text-foreground">Download Queue</h3>
          </div>
          <div class="flex max-h-75 flex-col gap-2 overflow-y-auto p-4">
            <div v-for="job in args.jobs" :key="job.id" class="flex items-center justify-between gap-2 rounded-lg bg-secondary px-3 py-2 text-sm">
              <span class="truncate text-foreground">{{ job.name }}</span>
              <span class="text-muted-foreground">{{ Math.round(job.progress * 100) }}%</span>
            </div>
          </div>
          <template #footer="{ toggle }">
            <div class="flex h-12 items-center justify-between gap-2 border-t border-border px-4 text-sm">
              <i :class="args.statusIcon" />
              <span class="font-bold text-foreground">{{ args.status }}</span>
              <Button variant="muted-textonly" size="icon" @click.stop="toggle">
                <i :class="isExpanded ? 'icon-[lucide--chevron-down]' : 'icon-[lucide--chevron-up]'" />
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
      createMockJob({ progress: 1 }),
      createMockJob({
        name: 'lora-style.safetensors',
        progress: 0.45,
        id: 'task-2'
      }),
      createMockJob({ name: 'vae-decoder.safetensors', id: 'task-3' })
    ],
    status: 'lora-style.safetensors',
    statusIcon:
      'icon-[lucide--loader-circle] motion-safe:animate-spin text-muted-foreground'
  }
}

export const Completed: Story = {
  args: {
    expanded: false,
    jobs: [createMockJob({ progress: 1 })],
    status: 'All downloads completed',
    statusIcon: 'icon-[lucide--check-circle] text-jade-600'
  }
}

export const WithError: Story = {
  args: {
    expanded: true,
    jobs: [createMockJob({ progress: 0.23 })],
    status: '1 download failed',
    statusIcon: 'icon-[lucide--circle-alert] text-destructive'
  }
}
