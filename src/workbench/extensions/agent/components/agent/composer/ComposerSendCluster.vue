<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'

import RunModePopover from './RunModePopover.vue'

const {
  editing,
  showStop,
  tooltip,
  label,
  shortcut,
  blockedReason,
  ariaDisabled,
  disabled
} = defineProps<{
  editing: boolean
  showStop: boolean
  tooltip: string
  label: string
  shortcut?: string
  blockedReason?: string
  ariaDisabled?: boolean
  disabled: boolean
}>()

const emit = defineEmits<{
  cancelEdit: []
  primary: []
}>()

const { t } = useI18n()
</script>

<template>
  <div class="flex items-center gap-1">
    <RunModePopover />
    <Button
      v-show="editing"
      type="button"
      variant="muted-textonly"
      size="sm"
      :aria-label="t('agent.queue.cancelEdit')"
      @click="emit('cancelEdit')"
    >
      {{ t('agent.queue.cancelEdit') }}
    </Button>
    <Button
      :tooltip
      type="button"
      :variant="showStop ? 'secondary' : 'inverted'"
      size="icon"
      :aria-label="label"
      :aria-disabled="ariaDisabled"
      :aria-description="blockedReason"
      :disabled
      class="aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-foreground"
      @click="emit('primary')"
    >
      <i-lucide:square v-if="showStop" class="size-4" />
      <i-lucide:arrow-up v-else class="size-4" />
      <template #tooltip>
        {{ tooltip }}
        <span v-if="shortcut" class="ml-1 opacity-50">{{ shortcut }}</span>
      </template>
    </Button>
  </div>
</template>
