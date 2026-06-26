<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from '@/components/ui/button/Button.vue'
import { useTooltipConfig } from '@/renderer/extensions/vueNodes/composables/useNodeTooltips'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useSettingsDialog } from '@/platform/settings/composables/useSettingsDialog'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'
import { app } from '@/scripts/app'

const { t } = useI18n()
const settingStore = useSettingStore()
const settingsDialog = useSettingsDialog()
const rightSidePanelStore = useRightSidePanelStore()
const { createTooltipConfig } = useTooltipConfig()

const tooltipConfig = computed(() =>
  createTooltipConfig(t('rightSidePanel.advancedWidgetSettings'))
)

function openSettings() {
  const isLegacyMenu = settingStore.get('Comfy.UseNewMenu') === 'Disabled'
  if (isLegacyMenu) {
    settingsDialog.show(undefined, 'Comfy.Node.AlwaysShowAdvancedWidgets')
  } else {
    if (app?.canvas) {
      app.canvas.deselectAll()
    }
    rightSidePanelStore.openPanel('settings')
    rightSidePanelStore.triggerHighlight('Comfy.Node.AlwaysShowAdvancedWidgets')
  }
}
</script>

<template>
  <Button
    v-tooltip.bottom="tooltipConfig"
    variant="textonly"
    data-testid="advanced-settings-button"
    :aria-label="t('rightSidePanel.advancedWidgetSettings')"
    @pointerdown.stop
    @pointerup.stop
    @mousedown.stop
    @mouseup.stop
    @click.stop="openSettings"
  >
    <i
      class="hover:text-foreground icon-[lucide--settings] size-4 text-muted-foreground"
    />
  </Button>
</template>
