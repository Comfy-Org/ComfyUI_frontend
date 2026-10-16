<template>
  <Teleport to="body">
    <div
      role="group"
      :aria-label="$t('openOnCloud.prototype.label')"
      class="fixed right-4 bottom-4 z-3000 flex flex-col gap-1.5 rounded-lg border border-border-default bg-base-background p-2 text-xs shadow-lg"
      data-testid="cloud-check-prototype-switch"
    >
      <span class="px-1 text-muted-foreground">
        {{ $t('openOnCloud.prototype.label') }}
      </span>
      <ToggleGroup v-model="prototypeCheck" type="single" :allow-empty="false">
        <ToggleGroupItem
          v-for="option in options"
          :key="option.value"
          :value="option.value"
          size="sm"
          class="px-2.5"
        >
          {{ option.label }}
        </ToggleGroupItem>
      </ToggleGroup>
      <Button
        variant="secondary"
        size="sm"
        class="h-7"
        data-testid="prototype-simulate-out-of-memory"
        @click="simulateOutOfMemory"
      >
        <i class="icon-[lucide--memory-stick] size-3.5" aria-hidden="true" />
        {{ $t('openOnCloud.prototype.simulateOutOfMemory') }}
      </Button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { PrototypeCloudCheck } from '@/platform/openOnCloud/cloudWorkflowCheck'
import { prototypeOutOfMemoryError } from '@/platform/openOnCloud/prototypeOutOfMemory'
import { useCloudWorkflowCheckStore } from '@/platform/openOnCloud/stores/cloudWorkflowCheckStore'
import { app } from '@/scripts/app'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'

const { t } = useI18n()
const options = computed<{ value: PrototypeCloudCheck; label: string }[]>(
  () => [
    { value: 'checking', label: t('openOnCloud.prototype.checking') },
    { value: 'canOpen', label: t('openOnCloud.prototype.canOpen') },
    { value: 'missing', label: t('openOnCloud.prototype.missing') }
  ]
)

const { prototypeCheck } = storeToRefs(useCloudWorkflowCheckStore())
const executionErrorStore = useExecutionErrorStore()

function simulateOutOfMemory() {
  const error = prototypeOutOfMemoryError(app.rootGraph.nodes, Date.now())
  if (!error) return
  executionErrorStore.recordExecutionError(error)
  executionErrorStore.showExecutionError(error)
}
</script>
