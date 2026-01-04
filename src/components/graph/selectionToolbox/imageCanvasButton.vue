<template>
  <Button
    v-show="isSingleImageNode"
    v-tooltip.top="{
      value: $t('commands.Comfy_imageCanvas_OpenimageCanvas.label'),
      showDelay: 1000
    }"
    variant="muted-textonly"
    :aria-label="$t('commands.Comfy_imageCanvas_OpenimageCanvas.label')"
    @click="openimageCanvas"
  >
    <i class="icon-[comfy--mask]" />
  </Button>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'
import { useSelectionState } from '@/composables/graph/useSelectionState'
import { useCommandStore } from '@/stores/commandStore'

const commandStore = useCommandStore()
const { isSingleImageNode } = useSelectionState()

const openimageCanvas = () => {
  void commandStore.execute('Comfy.imageCanvas.OpenimageCanvas')
}
</script>
