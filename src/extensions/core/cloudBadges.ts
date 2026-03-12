import { computed, watch } from 'vue'
import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'
import { t } from '@/i18n'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useExtensionService } from '@/services/extensionService'
import type { TopbarBadge } from '@/types/comfy'

const badges = computed<TopbarBadge[]>(() => {
  const result: TopbarBadge[] = []

  // Add server health alert first (if present)
  const alert = remoteConfig.value.server_health_alert
  if (alert) {
    result.push({
      text: alert.message,
      label: alert.badge,
      variant: alert.severity ?? 'error',
      tooltip: alert.tooltip
    })
  }
  return result
})

const canvasStore = useCanvasStore()
watch(
  () => canvasStore.canvas,
  (canvas) => {
    if (canvas) {
      canvas.info_text = t('g.comfyCloud')
    }
  },
  { immediate: true }
)

useExtensionService().registerExtension({
  name: 'Comfy.Cloud.Badges',
  get topbarBadges() {
    return badges.value
  }
})
