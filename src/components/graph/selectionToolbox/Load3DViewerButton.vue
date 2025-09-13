<template>
  <Button
    v-tooltip.top="{
      value: t('commands.Comfy_3DViewer_Open3DViewer.label'),
      showDelay: 1000
    }"
    severity="secondary"
    text
    icon="pi pi-pencil"
    icon-class="w-4 h-4"
    @click="open3DViewer"
  />
</template>

<script setup lang="ts">
import Button from 'primevue/button'

import { t } from '@/i18n'
import { useCommandStore } from '@/stores/commandStore'

const commandStore = useCommandStore()

const open3DViewer = () => {
  void commandStore.execute('Comfy.3DViewer.Open3DViewer')
}
</script>
