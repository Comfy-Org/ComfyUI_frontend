<script setup lang="ts">
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'

const { selectedCount, attachableCount, downloadOnlyCount } = defineProps<{
  selectedCount: number
  attachableCount: number
  downloadOnlyCount: number
}>()
const emit = defineEmits<{ add: []; download: []; clear: [] }>()

const { t } = useI18n()

const noteId = useId()
const note = computed(() => {
  if (downloadOnlyCount === 0) return ''
  return attachableCount === 0
    ? t('agent.outputs.cannotAdd')
    : t('agent.outputs.downloadOnly', downloadOnlyCount)
})
</script>

<template>
  <div class="flex flex-col gap-2">
    <p v-if="note" :id="noteId" class="m-0 text-xs text-muted-foreground">
      {{ note }}
    </p>
    <div class="flex flex-wrap items-center justify-end gap-2">
      <div
        class="flex min-w-0 flex-1 items-center gap-1 text-xs text-muted-foreground"
      >
        <span class="truncate">
          {{
            selectedCount > 0
              ? t('agent.outputs.selected', selectedCount)
              : t('agent.outputs.noneSelected')
          }}
        </span>
        <Button
          v-if="selectedCount > 0"
          type="button"
          variant="muted-textonly"
          size="sm"
          class="shrink-0"
          @click="emit('clear')"
        >
          {{ t('agent.outputs.clear') }}
        </Button>
      </div>
      <Button
        type="button"
        variant="secondary"
        size="md"
        class="shrink-0"
        :disabled="selectedCount === 0"
        @click="emit('download')"
      >
        {{
          selectedCount > 0
            ? t('agent.outputs.downloadCount', selectedCount)
            : t('agent.outputs.download')
        }}
      </Button>
      <Button
        type="button"
        variant="inverted"
        size="md"
        class="shrink-0"
        :disabled="attachableCount === 0"
        :aria-describedby="note ? noteId : undefined"
        @click="emit('add')"
      >
        {{
          attachableCount > 0
            ? t('agent.outputs.addCount', attachableCount)
            : t('agent.outputs.add')
        }}
      </Button>
    </div>
  </div>
</template>
