<template>
  <Button
    v-tooltip.top="{
      value:
        st(`commands.${normalizeI18nKey(command.id)}.label`, '') || undefined,
      showDelay: 1000
    }"
    severity="secondary"
    text
    :icon="typeof command.icon === 'function' ? command.icon() : command.icon"
    @click="() => commandStore.execute(command.id)"
  />
</template>

<script setup lang="ts">
import Button from 'primevue/button'

import { st } from '@/i18n'
import { ComfyCommand, useCommandStore } from '@/stores/commandStore'
import { normalizeI18nKey } from '@/utils/formatUtil'

defineProps<{
  command: ComfyCommand
}>()

const commandStore = useCommandStore()
</script>
