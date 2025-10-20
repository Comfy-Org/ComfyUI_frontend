<template>
  <div class="flex w-full items-center justify-between px-3 py-4">
    <div class="flex w-full items-center justify-between gap-2 pr-1">
      <Button
        :label="$t('manager.conflicts.conflictInfoTitle')"
        text
        severity="secondary"
        size="small"
        icon="pi pi-info-circle"
        :pt="{
          label: { class: 'text-sm' }
        }"
        @click="handleConflictInfoClick"
      />
      <Button
        v-if="props.buttonText"
        :label="props.buttonText"
        severity="secondary"
        size="small"
        @click="handleButtonClick"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'

import { useDialogStore } from '@/stores/dialogStore'

interface Props {
  buttonText?: string
  onButtonClick?: () => void
}
const props = withDefaults(defineProps<Props>(), {
  buttonText: undefined,
  onButtonClick: undefined
})
const dialogStore = useDialogStore()
const handleConflictInfoClick = () => {
  window.open(
    'https://docs.comfy.org/troubleshooting/custom-node-issues',
    '_blank'
  )
}
const handleButtonClick = () => {
  // Close the conflict dialog
  dialogStore.closeDialog({ key: 'global-node-conflict' })
  // Execute the custom button action if provided
  if (props.onButtonClick) {
    props.onButtonClick()
  }
}
</script>
