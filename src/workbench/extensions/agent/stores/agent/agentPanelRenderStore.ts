import { useTimeoutFn } from '@vueuse/core'
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

import { useTelemetry } from '@/platform/telemetry'
import type { AgentPanelRenderStage } from '@/platform/telemetry/types'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

const AGENT_PANEL_RENDER_STALL_MS = 3_000

/** Tracks how far each opening of the agent panel gets toward drawn content. */
export const useAgentPanelRenderStore = defineStore('agentPanelRender', () => {
  const agentPanelStore = useAgentPanelStore()
  const progress = ref<AgentPanelRenderStage | 'drawn'>('dock_unresolved')

  const stallTimer = useTimeoutFn(
    () => {
      const stage = progress.value
      if (stage !== 'drawn')
        useTelemetry()?.trackAgentPanelRenderStalled({ stage })
    },
    AGENT_PANEL_RENDER_STALL_MS,
    { immediate: false }
  )

  watch(
    () => agentPanelStore.isVisible,
    (visible) => {
      progress.value = 'dock_unresolved'
      if (visible) stallTimer.start()
      else stallTimer.stop()
    },
    { immediate: true }
  )

  function reach(
    stage: 'root_unresolved' | 'root_resolved_not_mounted' | 'drawn'
  ) {
    progress.value = stage
  }

  return { progress, reach }
})
