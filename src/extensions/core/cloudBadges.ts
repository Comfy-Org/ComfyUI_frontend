import { computed, effectScope, watch } from 'vue'
import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'
import { useBootDeploymentFullLabel } from '@/platform/workspace/composables/useDeploymentLabels'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useExtensionService } from '@/services/extensionService'
import { toTitleCase } from '@/utils/textCaseUtil'
import type { TopbarBadge } from '@/types/comfy'

const badges = computed<TopbarBadge[]>(() => {
  const result: TopbarBadge[] = []

  // Add server health alert first (if present)
  const alert = remoteConfig.value.server_health_alert
  if (alert) {
    const message = toTitleCase(alert.message)
    result.push({
      text: message,
      label: alert.badge,
      variant: alert.severity ?? 'error',
      tooltip: alert.tooltip
    })
  }
  return result
})

const canvasInfoTextScope = effectScope(true)

function syncCanvasInfoText() {
  const canvasStore = useCanvasStore()
  const runningOn = useBootDeploymentFullLabel()
  watch(
    [() => canvasStore.canvas, runningOn],
    ([canvas, label]) => {
      if (canvas && label !== undefined) canvas.info_text = label
    },
    { immediate: true }
  )
}

useExtensionService().registerExtension({
  name: 'Comfy.Cloud.Badges',
  get topbarBadges() {
    return badges.value
  },
  init() {
    canvasInfoTextScope.run(syncCanvasInfoText)
  }
})
