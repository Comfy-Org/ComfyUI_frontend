<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Loader from '@/components/loader/Loader.vue'
import Popover from '@/components/ui/Popover.vue'
import Button from '@/components/ui/button/Button.vue'
import { useCommandStore } from '@/stores/commandStore'
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
    <Popover side="top" :show-arrow="false" @focus-outside.prevent>
      <template #button>
        <Button
          v-tooltip.top="t('linearMode.queue.clickToClear')"
          :aria-label="t('linearMode.queue.clickToClear')"
          variant="textonly"
          size="unset"
          class="flex size-10 items-center justify-center rounded-sm bg-secondary-background"
        >
          <Loader
            :variant="
              queueStore.runningTasks.length ? 'loader-circle' : 'loader'
            "
            size="sm"
            class="text-muted-foreground"
          />
        </Button>
      </template>
      <template #default="{ close }">
        <Button
          :disabled="queueCount === 0"
          variant="textonly"
          class="px-4 text-sm text-destructive-background"
          @click="clearQueue(close)"
        >
          <i class="icon-[lucide--list-x]" />
          {{ t('linearMode.queue.clear') }}
        </Button>
      </template>
    </Popover>
    <div
      v-if="queueCount > 1"
      aria-hidden="true"
      class="absolute top-0 right-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary-background text-xs text-text-primary"
      v-text="queueCount"
    />
  </div>
</template>
