<script setup lang="ts">
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'

const {
  title,
  loading = false,
  failed = false
} = defineProps<{
  title: string
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
      <span
        v-if="loading"
        aria-hidden="true"
        class="icon-[lucide--loader-circle] size-4 shrink-0 animate-spin"
      />
      <span
        v-else
        aria-hidden="true"
        class="icon-[lucide--circle-check] size-4 shrink-0"
      />
      <span class="truncate">{{ displayTitle }}</span>
    </Button>
    <span v-if="loading" role="status" class="sr-only">{{
      t('g.loading')
    }}</span>
    <span
      v-if="failed"
      :id="errorId"
      role="alert"
      class="pl-6 text-xs whitespace-normal text-destructive-background"
      >{{ t('agent.historyOpenFailed') }}</span
    >
  </div>
</template>
