<template>
  <Button
    v-tooltip.top="{
      value: t('commands.Comfy_Canvas_DeleteSelectedItems.label'),
      showDelay: 1000
    }"
    severity="danger"
    text
    icon="pi pi-trash"
    @click="() => commandStore.execute('Comfy.Canvas.DeleteSelectedItems')"
  />
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { useI18n } from 'vue-i18n'

import { useCommandStore } from '@/stores/commandStore'

const { t } = useI18n()
const commandStore = useCommandStore()
</script>
