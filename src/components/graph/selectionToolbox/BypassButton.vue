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
    :class="{
      'hover:dark-theme:!bg-[#262729] hover:!bg-[#E7E6E6]': true,
      'dark-theme:[&:not(:active)]:!bg-[#262729] [&:not(:active)]:!bg-[#E7E6E6]':
        isByPassed
    }"
    @click="() => byPass()"
  >
    <template #icon>
      <i-lucide:ban />
    </template>
  </Button>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { LGraphEventMode } from '@/lib/litegraph/src/litegraph'
import { useCommandStore } from '@/stores/commandStore'
import { useCanvasStore } from '@/stores/graphStore'
import { isLGraphNode } from '@/utils/litegraphUtil'

const { t } = useI18n()
const commandStore = useCommandStore()
const canvasStore = useCanvasStore()
const clickRef = ref(0)

const isByPassed = computed<Boolean>(() => {
  // had to do this hack cos it wasnt reactive
  clickRef.value
  if (canvasStore.selectedItems.length !== 1) return false
  const item = canvasStore.selectedItems[0] as LGraphNode
  if (!isLGraphNode(item)) return false
  return item.mode === LGraphEventMode.BYPASS
})

const byPass = () => {
  clickRef.value += 1
  commandStore.execute('Comfy.Canvas.ToggleSelectedNodes.Bypass')
}
</script>
