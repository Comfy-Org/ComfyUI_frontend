<template>
  <Button
    :tooltip="$t('commands.Comfy_MaskEditor_OpenMaskEditor.label')"
    variant="muted-textonly"
    :aria-label="$t('commands.Comfy_MaskEditor_OpenMaskEditor.label')"
    @click="openMaskEditor"
  >
    <i class="icon-[comfy--mask] size-[1.2em]" />
  </Button>
</template>

<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'
import { useCommandStore } from '@/stores/commandStore'

const commandStore = useCommandStore()

const openMaskEditor = () => {
  void commandStore.execute('Comfy.MaskEditor.OpenMaskEditor')
}
</script>
