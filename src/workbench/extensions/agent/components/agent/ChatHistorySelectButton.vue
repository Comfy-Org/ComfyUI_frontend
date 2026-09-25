<script setup lang="ts">
import { computed } from 'vue'
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
</script>

<template>
  <Button
    type="button"
    variant="muted-textonly"
    size="unset"
    :aria-busy="loading"
    :aria-label="displayTitle"
    :disabled="loading"
    class="min-w-0 flex-1 justify-start text-left text-xs font-normal"
    @click="emit('select')"
  >
    <span
      v-if="loading"
      role="status"
      :aria-label="t('g.loading')"
      class="icon-[lucide--loader-circle] size-4 shrink-0 animate-spin"
    />
    <span v-else class="icon-[lucide--circle-check] size-4 shrink-0" />
    <span class="flex min-w-0 flex-col">
      <span class="truncate">{{ displayTitle }}</span>
      <span
        v-if="failed"
        role="alert"
        class="text-xs whitespace-normal text-destructive-background"
        >{{ t('agent.historyOpenFailed') }}</span
      >
    </span>
  </Button>
</template>
