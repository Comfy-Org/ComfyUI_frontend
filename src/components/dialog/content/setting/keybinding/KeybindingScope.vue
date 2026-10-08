<template>
  <span
    v-if="label"
    class="truncate text-xs text-muted-foreground"
    data-testid="keybinding-scope"
  >
    {{ label }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { KeybindingImpl } from '@/platform/keybindings/keybinding'

const { binding } = defineProps<{
  binding: KeybindingImpl
}>()

const { t } = useI18n()

const label = computed(() =>
  [
    binding.dialogKey &&
      t('g.keybindingInDialog', { dialog: binding.dialogKey }),
    binding.when && t('g.keybindingWhen', { when: binding.when })
  ]
    .filter(Boolean)
    .join(', ')
)
</script>
