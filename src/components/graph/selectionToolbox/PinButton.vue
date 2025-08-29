<template>
  <Button
    v-show="hasAnySelection"
    v-tooltip.top="{
      value: t('commands.Comfy_Canvas_ToggleSelectedNodes_Pin.label'),
      showDelay: 1000
    }"
    severity="secondary"
    text
    icon="pi pi-thumbtack"
    @click="() => commandStore.execute('Comfy.Canvas.ToggleSelected.Pin')"
  />
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { useI18n } from 'vue-i18n'

import { useSelectionState } from '@/composables/graph/useSelectionState'
import { useCommandStore } from '@/stores/commandStore'

const { t } = useI18n()
const commandStore = useCommandStore()
const { hasAnySelection } = useSelectionState()
</script>
