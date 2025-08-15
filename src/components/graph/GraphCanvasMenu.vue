<template>
  <ButtonGroup
    class="p-buttongroup-vertical absolute bottom-[10px] right-[10px] z-[1000]"
    @wheel="canvasInteractions.handleWheel"
  >
    <Button
      v-tooltip.left="t('graphCanvasMenu.zoomIn')"
      severity="secondary"
      icon="pi pi-plus"
      :aria-label="$t('graphCanvasMenu.zoomIn')"
      @mousedown="repeat('Comfy.Canvas.ZoomIn')"
      @mouseup="stopRepeat"
    />
    <Button
      v-tooltip.left="t('graphCanvasMenu.zoomOut')"
      severity="secondary"
      icon="pi pi-minus"
      :aria-label="$t('graphCanvasMenu.zoomOut')"
      @mousedown="repeat('Comfy.Canvas.ZoomOut')"
      @mouseup="stopRepeat"
    />
    <Button
      v-tooltip.left="t('graphCanvasMenu.fitView')"
      severity="secondary"
      icon="pi pi-expand"
      :aria-label="$t('graphCanvasMenu.fitView')"
      @click="() => commandStore.execute('Comfy.Canvas.FitView')"
    />
    <Button
      v-tooltip.left="
        t(
          'graphCanvasMenu.' +
            (canvasStore.canvas?.read_only ? 'panMode' : 'selectMode')
        ) + ' (Space)'
      "
      severity="secondary"
      :aria-label="
        t(
          'graphCanvasMenu.' +
            (canvasStore.canvas?.read_only ? 'panMode' : 'selectMode')
        )
      "
      @click="() => commandStore.execute('Comfy.Canvas.ToggleLock')"
    >
      <template #icon>
        <i-material-symbols:pan-tool-outline
          v-if="canvasStore.canvas?.read_only"
        />
        <i-simple-line-icons:cursor v-else />
      </template>
    </Button>
    <Button
      v-tooltip.left="t('graphCanvasMenu.toggleLinkVisibility')"
      severity="secondary"
      :icon="linkHidden ? 'pi pi-eye-slash' : 'pi pi-eye'"
      :aria-label="$t('graphCanvasMenu.toggleLinkVisibility')"
      data-testid="toggle-link-visibility-button"
      @click="() => commandStore.execute('Comfy.Canvas.ToggleLinkVisibility')"
    />
    <Button
      v-tooltip.left="minimapTooltip"
      severity="secondary"
      :icon="'pi pi-map'"
      :aria-label="$t('graphCanvasMenu.toggleMinimap')"
      :class="{ 'minimap-active': minimapVisible }"
      data-testid="toggle-minimap-button"
      @click="() => commandStore.execute('Comfy.Canvas.ToggleMinimap')"
    />
  </ButtonGroup>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import ButtonGroup from 'primevue/buttongroup'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useCanvasInteractions } from '@/composables/graph/useCanvasInteractions'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { useCommandStore } from '@/stores/commandStore'
import { useCanvasStore } from '@/stores/graphStore'
import { useKeybindingStore } from '@/stores/keybindingStore'
import { useSettingStore } from '@/stores/settingStore'

const { t } = useI18n()
const commandStore = useCommandStore()
const canvasStore = useCanvasStore()
const keybindingStore = useKeybindingStore()
const settingStore = useSettingStore()
const canvasInteractions = useCanvasInteractions()

const minimapVisible = computed(() => settingStore.get('Comfy.Minimap.Visible'))
const minimapTooltip = computed(() => {
  const baseText = t('graphCanvasMenu.toggleMinimap')
  const keybinding = keybindingStore.getKeybindingByCommandId(
    'Comfy.Canvas.ToggleMinimap'
  )
  return keybinding ? `${baseText} (${keybinding.combo.toString()})` : baseText
})
const linkHidden = computed(
  () => settingStore.get('Comfy.LinkRenderMode') === LiteGraph.HIDDEN_LINK
)

let interval: number | null = null
const repeat = async (command: string) => {
  if (interval) return
  const cmd = () => commandStore.execute(command)
  await cmd()
  interval = window.setInterval(cmd, 100)
}
const stopRepeat = () => {
  if (interval) {
    clearInterval(interval)
    interval = null
  }
}
</script>

<style scoped>
.p-buttongroup-vertical {
  display: flex;
  flex-direction: column;
  border-radius: var(--p-button-border-radius);
  overflow: hidden;
  border: 1px solid var(--p-panel-border-color);
}

.p-buttongroup-vertical .p-button {
  margin: 0;
  border-radius: 0;
}

.p-button.minimap-active {
  background-color: var(--p-button-primary-background);
  border-color: var(--p-button-primary-border-color);
  color: var(--p-button-primary-color);
}

.p-button.minimap-active:hover {
  background-color: var(--p-button-primary-hover-background);
  border-color: var(--p-button-primary-hover-border-color);
}
</style>
