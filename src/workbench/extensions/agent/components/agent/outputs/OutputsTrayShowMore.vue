<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import type { OutputsTrayState } from '@/workbench/extensions/agent/stores/agent/agentOutputsTray'

const { more, hasHiddenLoaded } = defineProps<{
  more: Extract<OutputsTrayState, { phase: 'open' }>['more']
  hasHiddenLoaded: boolean
}>()
const emit = defineEmits<{ showMore: [] }>()

const { t } = useI18n()

const loadingMore = computed(() => more === 'loading')
const loadFailed = computed(() => more === 'failed' && !hasHiddenLoaded)
const label = computed(() =>
  loadingMore.value ? t('agent.outputs.loadingMore') : t('agent.showMore')
)
</script>

<template>
  <div class="flex flex-col items-center gap-1 pt-2">
    <p v-if="loadFailed" role="alert" class="m-0 text-xs text-muted-foreground">
      {{ t('agent.outputs.loadMoreFailed') }}
    </p>
    <Button
      type="button"
      variant="outline"
      size="sm"
      class="rounded-full border-border"
      :aria-busy="loadingMore || undefined"
      @click="emit('showMore')"
    >
      {{ label }}
    </Button>
  </div>
</template>
