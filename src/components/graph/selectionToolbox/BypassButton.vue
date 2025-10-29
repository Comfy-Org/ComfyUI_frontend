<template>
  <Button
    v-tooltip.top="{
      value: t('commands.Comfy_Canvas_ToggleSelectedNodes_Bypass.label'),
      showDelay: 1000
    }"
    severity="secondary"
    text
    data-testid="bypass-button"
    class="hover:bg-secondary-background"
    @click="toggleBypass"
  >
    <template #icon>
      <i class="icon-[lucide--ban] h-4 w-4" />
    </template>
  </Button>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { useI18n } from 'vue-i18n'

import { useCommandStore } from '@/stores/commandStore'

const { t } = useI18n()
const commandStore = useCommandStore()

const toggleBypass = async () => {
  await commandStore.execute('Comfy.Canvas.ToggleSelectedNodes.Bypass')
}
</script>
