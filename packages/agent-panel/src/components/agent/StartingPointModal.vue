<script setup lang="ts">
import { DialogDescription, DialogRoot, DialogTitle } from 'reka-ui'
import { useI18n } from 'vue-i18n'

import DialogContent from '../ui/DialogContent.vue'

export type StartingPoint = 'scratch' | 'template'

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ select: [choice: StartingPoint] }>()

const { t } = useI18n()

function choose(choice: StartingPoint): void {
  emit('select', choice)
  open.value = false
}
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogContent class="space-y-3">
      <DialogTitle class="text-agent-fg text-base font-semibold">
        {{ t('agent.startingPointTitle') }}
      </DialogTitle>
      <DialogDescription class="sr-only">
        {{ t('agent.startingPointTitle') }}
      </DialogDescription>
      <div class="flex flex-col gap-2">
        <button
          type="button"
          class="rounded-agent border-agent-border text-agent-fg hover:border-agent-border-strong hover:bg-agent-surface-hover flex items-center gap-3 border px-3 py-2.5 text-left text-sm transition-colors"
          @click="choose('scratch')"
        >
          <span class="text-agent-accent icon-[lucide--file-plus] size-5" />
          {{ t('agent.startFromScratch') }}
        </button>
        <button
          type="button"
          class="rounded-agent border-agent-border text-agent-fg hover:border-agent-border-strong hover:bg-agent-surface-hover flex items-center gap-3 border px-3 py-2.5 text-left text-sm transition-colors"
          @click="choose('template')"
        >
          <span
            class="text-agent-accent icon-[lucide--layout-template] size-5"
          />
          {{ t('agent.browseTemplates') }}
        </button>
      </div>
    </DialogContent>
  </DialogRoot>
</template>
