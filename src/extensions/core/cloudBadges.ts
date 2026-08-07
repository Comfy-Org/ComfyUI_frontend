import { computed, watch } from 'vue'
import { i18n, t } from '@/i18n'
import { isCloud } from '@/platform/distribution/types'
import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useExtensionService } from '@/services/extensionService'
import type { TopbarBadge } from '@/types/comfy'

const COMFY_CLOUD_YELLOW = '#F0FF41'

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
  [
    () => canvasStore.canvas,
    () => isCloud || Boolean(remoteConfig.value.comfy_api_base_url),
    () => i18n.global.locale.value
  ],
  ([canvas, showBranding]) => {
    if (!canvas) return
    if (showBranding) {
      canvas.info_text = t('g.comfyCloud')
      canvas.info_text_color = COMFY_CLOUD_YELLOW
    } else if (canvas.info_text_color === COMFY_CLOUD_YELLOW) {
      canvas.info_text = undefined
      canvas.info_text_color = undefined
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
