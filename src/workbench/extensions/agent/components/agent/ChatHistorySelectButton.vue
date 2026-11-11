<script setup lang="ts">
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import { cn } from '@comfyorg/tailwind-utils'

const {
  title,
  subtitle,
  loading = false,
  failed = false,
  fullRow = false
} = defineProps<{
  title: string
  subtitle?: string
  loading?: boolean
  failed?: boolean
  fullRow?: boolean
}>()
const emit = defineEmits<{ select: [] }>()
const { t } = useI18n()
const displayTitle = computed(() => title.trim() || t('agent.untitledChat'))
const errorId = useId()
const subtitleId = useId()
const describedBy = computed(
  () =>
    [fullRow && subtitle && subtitleId, failed && errorId]
      .filter(Boolean)
      .join(' ') || undefined
)
</script>

<template>
  <div class="flex min-w-0 flex-1 flex-col">
    <Button
      type="button"
      variant="muted-textonly"
      size="unset"
      :aria-busy="loading"
      :aria-label="displayTitle"
      :aria-describedby="describedBy"
      :disabled="loading"
      :class="
        cn(
          'min-w-0 justify-start text-left text-xs font-normal',
          fullRow &&
            'static grid grid-cols-[auto_minmax(0,1fr)] gap-y-0 after:absolute after:inset-0 after:rounded-sm focus-visible:ring-0 focus-visible:after:ring-1 focus-visible:after:ring-ring focus-visible:after:ring-inset'
        )
      "
      @click="emit('select')"
    >
      <i
        v-if="loading"
        aria-hidden="true"
        class="icon-[lucide--loader-circle] animate-spin"
      />
      <i v-else aria-hidden="true" class="icon-[lucide--circle-check]" />
      <span class="truncate">{{ displayTitle }}</span>
      <span
        v-if="fullRow && subtitle"
        :id="subtitleId"
        data-testid="chat-workflow-name"
        class="col-start-2 truncate text-muted-foreground"
        >{{ subtitle }}</span
      >
    </Button>
    <span
      v-if="!fullRow && subtitle"
      data-testid="chat-workflow-name"
      class="truncate pl-6 text-xs text-muted-foreground"
      >{{ subtitle }}</span
    >
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
