import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { WatchHandle } from 'vue'

import { useTelemetry } from '@comfyorg/telemetry'
import type {
  LocalMcpClient,
  LocalMcpPathAction
} from '@comfyorg/telemetry/types'
import { TelemetryEvents } from '@comfyorg/telemetry/types'

import {
  LOCAL_MCP_USAGE_SOURCE,
  readJobUsageSource
} from '@/platform/localMcp/localMcpConnection'
import { getJobDetail } from '@/services/jobOutputCache'
import { useQueueStore } from '@/stores/queueStore'

/**
 * State and funnel tracking for the Comfy MCP connect surface.
 *
 * Success signal: the first job this ComfyUI runs that comfy-mcp submitted.
 * ComfyUI stamps `extra_data.comfy_usage_source` from the submitting client
 * (see localMcpConnection.ts), so the job list reveals an agent that really
 * drove the install. This only fires once the agent has run a workflow; a bare
 * MCP handshake never touches ComfyUI, so it is not observable from here.
 */
export const useLocalMcpStore = defineStore('localMcp', () => {
  const connected = useLocalStorage('Comfy.LocalMcp.Connected', false)
  const panelOpened = ref(false)
  const exposureTracked = ref(false)
  const inspectedJobIds = new Set<string>()
  let stopQueueWatch: WatchHandle | undefined
  let watchStartedAt = 0

  function trackExposed() {
    if (exposureTracked.value) return
    exposureTracked.value = true
    useTelemetry()?.trackLocalMcpEvent({
      name: TelemetryEvents.LOCAL_MCP_EXPOSED,
      properties: {}
    })
  }

  function trackOpened() {
    if (panelOpened.value) return
    panelOpened.value = true
    useTelemetry()?.trackLocalMcpEvent({
      name: TelemetryEvents.LOCAL_MCP_OPENED,
      properties: {}
    })
  }

  function trackPathSelected(
    client: LocalMcpClient,
    action: LocalMcpPathAction
  ) {
    useTelemetry()?.trackLocalMcpEvent({
      name: TelemetryEvents.LOCAL_MCP_PATH_SELECTED,
      properties: { client, action }
    })
  }

  async function inspectJob(jobId: string) {
    const source = readJobUsageSource(await getJobDetail(jobId))
    if (source !== LOCAL_MCP_USAGE_SOURCE || connected.value) return

    connected.value = true
    stopWatching()
    useTelemetry()?.trackLocalMcpEvent({
      name: TelemetryEvents.LOCAL_MCP_CONNECTED,
      properties: {
        usage_source: source,
        panel_opened_this_session: panelOpened.value
      }
    })
  }

  function startWatching() {
    if (connected.value || stopQueueWatch) return
    watchStartedAt = Date.now()
    const queueStore = useQueueStore()
    stopQueueWatch = watch(
      () => queueStore.tasks,
      (tasks) => {
        for (const { job } of tasks) {
          if (job.create_time < watchStartedAt) continue
          if (inspectedJobIds.has(job.id)) continue
          inspectedJobIds.add(job.id)
          void inspectJob(job.id)
        }
      },
      { immediate: true }
    )
  }

  function stopWatching() {
    stopQueueWatch?.()
    stopQueueWatch = undefined
  }

  return {
    connected,
    trackExposed,
    trackOpened,
    trackPathSelected,
    startWatching,
    stopWatching
  }
})
