<template>
  <Panel
    class="selection-toolbox absolute left-1/2"
    :pt="{
      header: 'hidden',
      content: 'p-0 flex flex-row'
    }"
  >
    <Button
      severity="secondary"
      text
      icon="pi pi-thumbtack"
      @click="() => commandStore.execute('Comfy.Canvas.ToggleSelected.Pin')"
    />
    <Button
      severity="danger"
      text
      icon="pi pi-trash"
      @click="() => commandStore.execute('Comfy.Canvas.DeleteSelectedItems')"
    />
  </Panel>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Panel from 'primevue/panel'

import { useCommandStore } from '@/stores/commandStore'

const commandStore = useCommandStore()
</script>

<style scoped>
.selection-toolbox {
  transform: translateX(-50%) translateY(-120%);
}
</style>
