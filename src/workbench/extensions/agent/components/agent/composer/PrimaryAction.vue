<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Tooltip from '@/components/ui/tooltip/Tooltip.vue'

const { running, disabled } = defineProps<{
  running: boolean
  disabled: boolean
}>()
const emit = defineEmits<{ action: [] }>()
const { t } = useI18n()
const label = computed(() => (running ? t('agent.stop') : t('agent.send')))
</script>

<template>
  <Tooltip
    :config="label"
    side="top"
    :delay-duration="300"
    :ignore-non-keyboard-focus="false"
    disable-closing-trigger
    :collision-padding="8"
  >
    <Button
      type="button"
      :variant="running ? 'secondary' : 'inverted'"
      size="icon"
      :aria-label="label"
      :disabled
      @click="emit('action')"
    >
      <i-lucide:square v-if="running" class="size-4" />
      <i-lucide:arrow-up v-else class="size-4" />
    </Button>
    <template #content>
      {{ label }}
      <span v-if="running" class="ml-1 opacity-50">{{
        t('agent.stopShortcut')
      }}</span>
    </template>
  </Tooltip>
</template>
