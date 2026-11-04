<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'
import { cn } from '@comfyorg/tailwind-utils'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { RunPlan } from '@/renderer/extensions/superComfy/engine/types'

const { plan, running, disabled } = defineProps<{
  plan: RunPlan
  running: boolean
  disabled: boolean
}>()

const emit = defineEmits<{ run: []; stop: [] }>()

const { t } = useI18n()

const label = computed(() => {
  if (running) return t('superComfy.stop')
  const count = plan.ok ? plan.runs.length : 0
  return count > 1
    ? t('superComfy.node.runN', { count })
    : t('superComfy.node.run')
})

const tooltip = computed(() =>
  !running && !plan.ok && plan.block.reason === 'tooManyRuns'
    ? t('superComfy.node.tooManyRuns', {
        runs: plan.block.runs,
        limit: plan.block.limit
      })
    : undefined
)

function onClick() {
  if (running) emit('stop')
  else emit('run')
}
</script>

<template>
  <Button
    :variant="running ? 'secondary' : 'inverted'"
    size="sm"
    :disabled="disabled && !running"
    :tooltip
    data-no-drag
    @click="onClick"
  >
    <i
      :class="
        cn('size-3', running ? 'icon-[lucide--square]' : 'icon-[lucide--play]')
      "
    />
    {{ label }}
  </Button>
</template>
