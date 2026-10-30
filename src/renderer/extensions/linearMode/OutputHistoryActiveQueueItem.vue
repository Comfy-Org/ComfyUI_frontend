<script setup lang="ts">
import { PopoverRoot, PopoverTrigger } from 'reka-ui'
import { useI18n } from 'vue-i18n'

import Loader from '@/components/loader/Loader.vue'
import PopoverContent from '@comfyorg/design-system/popover/PopoverContent'
import Button from '@comfyorg/design-system/button/Button'
import { useCommandStore } from '@/platform/keybindings/commandStore'
import { useQueueStore } from '@/stores/queueStore'

const { queueCount } = defineProps<{
  queueCount: number
}>()

const { t } = useI18n()
const commandStore = useCommandStore()
const queueStore = useQueueStore()

function clearQueue(close: () => void) {
  void commandStore.execute('Comfy.ClearPendingTasks')
  close()
}
</script>
<template>
  <div
    class="relative shrink-0 border-2 border-transparent p-1"
    data-testid="linear-job"
  >
    <PopoverRoot v-slot="{ close }">
      <PopoverTrigger as-child>
        <Button
          :tooltip="t('linearMode.queue.clickToClear')"
          :aria-label="t('linearMode.queue.clickToClear')"
          variant="textonly"
          size="unset"
          class="flex size-10 rounded-sm bg-secondary"
        >
          <Loader
            :variant="
              queueStore.runningTasks.length ? 'loader-circle' : 'loader'
            "
            size="sm"
            class="text-muted-foreground"
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        :side-offset="5"
        dismiss-on-viewport-change
        class="w-auto rounded-lg border-border/50 p-2 shadow-sm"
        @focus-outside.prevent
      >
        <Button
          :disabled="queueCount === 0"
          variant="textonly"
          class="px-4 text-sm text-destructive"
          @click="clearQueue(close)"
        >
          <i class="icon-[lucide--list-x]" />
          {{ t('linearMode.queue.clear') }}
        </Button>
      </PopoverContent>
    </PopoverRoot>
    <div
      v-if="queueCount > 1"
      aria-hidden="true"
      data-testid="linear-job-badge"
      class="absolute top-0 right-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary text-xs text-foreground"
      v-text="queueCount"
    />
  </div>
</template>
