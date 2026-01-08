import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { cn } from '@/utils/tailwindUtil'

import HoneyToast from './HoneyToast.vue'

const meta: Meta<typeof HoneyToast> = {
  title: 'Toast/HoneyToast',
  component: HoneyToast,
  parameters: {
    layout: 'fullscreen'
  },
  decorators: [
    () => ({
      template: '<div class="h-screen bg-base-background p-8"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => ({
    components: { HoneyToast, Button },
    setup() {
      const isExpanded = ref(false)
      return { isExpanded, cn }
    },
    template: `
      <HoneyToast v-model:expanded="isExpanded" :visible="true">
        <template #default>
          <div class="flex h-12 items-center justify-between border-b border-border-default px-4">
            <h3 class="text-sm font-bold text-base-foreground">Progress Items</h3>
          </div>
          <div class="relative max-h-[300px] overflow-y-auto px-4 py-4">
            <div class="flex flex-col gap-2">
              <div class="rounded-lg bg-modal-card-background px-4 py-3 text-sm text-base-foreground">
                Item 1 - Completed
              </div>
              <div class="rounded-lg bg-modal-card-background px-4 py-3 text-sm text-base-foreground">
                Item 2 - In Progress
              </div>
              <div class="rounded-lg bg-modal-card-background px-4 py-3 text-sm text-base-foreground">
                Item 3 - Pending
              </div>
            </div>
          </div>
        </template>
        
        <template #footer="{ toggle }">
          <div class="flex h-12 items-center justify-between border-t border-border-default px-4">
            <div class="flex items-center gap-2 text-sm">
              <i class="icon-[lucide--loader-circle] size-4 animate-spin text-muted-foreground" />
              <span class="font-bold text-base-foreground">Processing items...</span>
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
      </HoneyToast>
    `
  })
}

export const Expanded: Story = {
  render: () => ({
    components: { HoneyToast, Button },
    setup() {
      const isExpanded = ref(true)
      return { isExpanded, cn }
    },
    template: `
      <HoneyToast v-model:expanded="isExpanded" :visible="true">
        <template #default>
          <div class="flex h-12 items-center justify-between border-b border-border-default px-4">
            <h3 class="text-sm font-bold text-base-foreground">Download Queue</h3>
          </div>
          <div class="relative max-h-[300px] overflow-y-auto px-4 py-4">
            <div class="flex flex-col gap-2">
              <div class="rounded-lg bg-modal-card-background px-4 py-3">
                <div class="flex items-center justify-between">
                  <span class="text-sm text-base-foreground">model-v1.safetensors</span>
                  <span class="text-xs text-jade-600">Completed ✓</span>
                </div>
              </div>
              <div class="rounded-lg bg-modal-card-background px-4 py-3">
                <div class="flex items-center justify-between">
                  <span class="text-sm text-base-foreground">lora-style.safetensors</span>
                  <div class="flex items-center gap-2">
                    <i class="icon-[lucide--loader-circle] size-4 animate-spin text-primary-background" />
                    <span class="text-xs text-primary-background">45%</span>
                  </div>
                </div>
              </div>
              <div class="rounded-lg bg-modal-card-background px-4 py-3">
                <div class="flex items-center justify-between">
                  <span class="text-sm text-base-foreground">vae-decoder.safetensors</span>
                  <span class="text-xs text-muted-foreground">Pending</span>
                </div>
              </div>
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
      </HoneyToast>
    `
  })
}

export const Collapsed: Story = {
  render: () => ({
    components: { HoneyToast, Button },
    setup() {
      const isExpanded = ref(false)
      return { isExpanded, cn }
    },
    template: `
      <HoneyToast v-model:expanded="isExpanded" :visible="true">
        <template #default>
          <div class="relative max-h-[300px] overflow-y-auto px-4 py-4">
            <p class="text-base-foreground">This content is hidden when collapsed.</p>
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
      </HoneyToast>
    `
  })
}

export const WithError: Story = {
  render: () => ({
    components: { HoneyToast, Button },
    setup() {
      const isExpanded = ref(true)
      return { isExpanded, cn }
    },
    template: `
      <HoneyToast v-model:expanded="isExpanded" :visible="true">
        <template #default>
          <div class="flex h-12 items-center justify-between border-b border-border-default px-4">
            <h3 class="text-sm font-bold text-base-foreground">Download Queue</h3>
          </div>
          <div class="relative max-h-[300px] overflow-y-auto px-4 py-4">
            <div class="flex flex-col gap-2">
              <div class="rounded-lg bg-modal-card-background px-4 py-3">
                <div class="flex items-center justify-between">
                  <span class="text-sm text-base-foreground">model-v1.safetensors</span>
                  <div class="flex items-center gap-2">
                    <i class="icon-[lucide--circle-alert] size-4 text-destructive-background" />
                    <span class="text-xs text-destructive-background">Failed</span>
                  </div>
                </div>
              </div>
              <div class="rounded-lg bg-modal-card-background px-4 py-3 opacity-50">
                <div class="flex items-center justify-between">
                  <span class="text-sm text-base-foreground">lora-style.safetensors</span>
                  <span class="text-xs text-jade-600">Completed ✓</span>
                </div>
              </div>
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
      </HoneyToast>
    `
  })
}

export const Hidden: Story = {
  render: () => ({
    components: { HoneyToast },
    template: `
      <div>
        <p class="text-base-foreground">HoneyToast is hidden when visible=false. Nothing appears at the bottom.</p>
        
        <HoneyToast :visible="false">
          <template #default>
            <div class="px-4 py-4">Content</div>
          </template>
          <template #footer>
            <div class="h-12 px-4">Footer</div>
          </template>
        </HoneyToast>
      </div>
    `
  })
}
