<template>
  <div class="flex items-center gap-2">
    <span
      :id="labelId"
      class="w-0 flex-1 truncate text-left font-sans text-xs text-muted-foreground"
    >
      <SettingHelp v-if="helpText" :text="helpText">{{ label }}</SettingHelp>
      <template v-else>{{ label }}</template>
    </span>
    <span class="shrink-0">
      <slot :label-id="labelId" />
    </span>
  </div>
</template>

<script setup lang="ts">
import { useId } from 'vue'

import SettingHelp from './SettingHelp.vue'

const { label, helpText } = defineProps<{
  label: string
  helpText?: string
}>()

const labelId = useId()
</script>
