<script setup lang="ts">
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'

const {
  title,
  preview,
  date,
  workflowName,
  current = false,
  loading = false,
  failed = false
} = defineProps<{
  title: string
  /** Rich search-result lines; omitted for the dense grouped rows. */
  preview?: string
  date?: string
  workflowName?: string
  current?: boolean
  loading?: boolean
  failed?: boolean
}>()
const emit = defineEmits<{ select: [] }>()
const { t } = useI18n()
const displayTitle = computed(() => title.trim() || t('agent.untitledChat'))
const errorId = useId()
</script>

<template>
  <div class="flex min-w-0 flex-1 flex-col">
    <Button
      type="button"
      variant="muted-textonly"
      size="unset"
      :aria-busy="loading"
      :aria-label="displayTitle"
      :aria-describedby="failed ? errorId : undefined"
      :disabled="loading"
      class="min-w-0 justify-start text-left text-xs font-normal"
      @click="emit('select')"
    >
      <i
        v-if="loading"
        aria-hidden="true"
        class="icon-[lucide--loader-circle] animate-spin"
      />
      <i v-else aria-hidden="true" class="icon-[lucide--circle-check]" />
      <span class="flex min-w-0 flex-col">
        <span class="truncate">{{ displayTitle }}</span>
        <template v-if="date !== undefined">
          <span v-if="preview" class="truncate text-xs text-muted-foreground">{{
            preview
          }}</span>
          <span
            class="flex min-w-0 items-center gap-2 text-xs text-muted-foreground"
          >
            <span class="shrink-0">{{ date }}</span>
            <span v-if="current" class="shrink-0 rounded-sm bg-muted px-1">{{
              t('agent.historyCurrentChat')
            }}</span>
            <span v-if="workflowName" class="ml-auto min-w-0 truncate">{{
              workflowName
            }}</span>
          </span>
        </template>
      </span>
    </Button>
    <span v-if="loading" role="status" class="sr-only">{{
      t('g.loading')
    }}</span>
    <span
      v-if="failed"
      :id="errorId"
      role="alert"
      class="pl-6 text-xs whitespace-normal text-destructive"
      >{{ t('agent.historyOpenFailed') }}</span
    >
  </div>
</template>
