<template>
  <div class="flex w-full items-center justify-between px-3 pb-4">
    <div class="flex w-full items-start justify-end gap-2 pr-1">
      <Button variant="secondary" @click="handleButtonClick">
        {{ $t('manager.conflicts.understood') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'
import { useDialogStore } from '@/stores/dialogStore'

const dialogStore = useDialogStore()
const handleButtonClick = () => {
  // Close the import failed dialog
  dialogStore.closeDialog({ key: 'global-import-failed' })
}
</script>
