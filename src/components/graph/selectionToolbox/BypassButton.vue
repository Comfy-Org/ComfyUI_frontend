<template>
  <Button
    v-show="canvasStore.nodeSelected"
    v-tooltip.top="{
      value: t('commands.Comfy_Canvas_ToggleSelectedNodes_Bypass.label'),
      showDelay: 1000
    }"
    severity="secondary"
    text
    data-testid="bypass-button"
    @click="
      () => commandStore.execute('Comfy.Canvas.ToggleSelectedNodes.Bypass')
    "
  >
    <template #icon>
      <i-game-icons:detour />
    </template>
  </Button>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { useI18n } from 'vue-i18n'

import { useCommandStore } from '@/stores/commandStore'
import { useCanvasStore } from '@/stores/graphStore'

const { t } = useI18n()
const commandStore = useCommandStore()
const canvasStore = useCanvasStore()
</script>
