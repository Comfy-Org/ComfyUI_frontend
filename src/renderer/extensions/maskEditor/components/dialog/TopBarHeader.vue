<template>
  <EditorToolbar :saving @save="handleSave" @cancel="handleCancel" />
</template>

<script setup lang="ts">
import { ref } from 'vue'

import EditorToolbar from '@comfyorg/mask-editor/ui/EditorToolbar'
import { useMaskEditorStore } from '@comfyorg/mask-editor/maskEditorStore'
import { useMaskEditorSaver } from '@/renderer/extensions/maskEditor/composables/useMaskEditorSaver'
import { useDialogStore } from '@/stores/dialogStore'

const store = useMaskEditorStore()
const dialogStore = useDialogStore()
const saver = useMaskEditorSaver()
const saving = ref(false)

const handleSave = async () => {
  saving.value = true

  try {
    store.brushVisible = false
    await saver.save()
    dialogStore.closeDialog()
  } catch (error) {
    console.error('[TopBarHeader] Save failed:', error)
    store.brushVisible = true
    saving.value = false
  }
}

const handleCancel = () => {
  dialogStore.closeDialog({ key: 'global-mask-editor' })
}
</script>
