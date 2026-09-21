<template>
  <span class="flex flex-row gap-0.5">
    <template v-for="(sequence, index) in keySequences" :key="index">
      <Badge
        class="min-w-6 justify-center gap-1 bg-interface-menu-keybind-surface-default text-center font-normal text-base-foreground capitalize"
        :severity="isModified ? 'info' : 'secondary'"
      >
        {{ sequence }}
      </Badge>
    </template>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import Badge from '@/components/ui/badge/Badge.vue'
import type { KeyComboImpl } from '@/platform/keybindings/keyCombo'

const { keyCombo, isModified = false } = defineProps<{
  keyCombo: KeyComboImpl
  isModified?: boolean
}>()

const keySequences = computed(() => keyCombo.getKeySequences())
</script>
