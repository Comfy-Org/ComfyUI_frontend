import { effectScope, watch } from 'vue'
import { useRemoteConfigStore } from '@/platform/remoteConfig/remoteConfigStore'
import { useBootDeploymentFullLabel } from '@/platform/workspace/composables/useDeploymentLabels'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { toTitleCase } from '@/utils/textCaseUtil'
import type { ComfyExtension, TopbarBadge } from '@/types/comfy'

function serverHealthBadges(): TopbarBadge[] {
  const result: TopbarBadge[] = []

  const alert = useRemoteConfigStore().config.server_health_alert
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
}

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

export const cloudBadgesExtension: ComfyExtension = {
  name: 'Comfy.Cloud.Badges',
  get topbarBadges() {
    return serverHealthBadges()
  },
  init() {
    canvasInfoTextScope.run(syncCanvasInfoText)
  }
}
