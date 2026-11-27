import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { WatchHandle } from 'vue'

import type { JobDetail } from '@comfyorg/api-client/jobTypes'
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
import { useSafeLocalStorage } from '@/platform/storage/useSafeStorage'
import { getJobDetail } from '@/services/jobOutputCache'
import { useQueueStore } from '@/stores/queueStore'

const MAX_DETAIL_ATTEMPTS = 3

/** Connect-surface state and funnel telemetry. */
export const useLocalMcpStore = defineStore('localMcp', () => {
  const connected = useSafeLocalStorage('Comfy.LocalMcp.Connected', false)
  const panelOpened = ref(false)
  const exposureTracked = ref(false)
  const inspectedJobIds = new Set<string>()
  const inFlightJobIds = new Set<string>()
  const detailAttempts = new Map<string, number>()
  let watchSession = 0
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
    client: LocalMcpClient | undefined,
    action: LocalMcpPathAction
  ) {
    useTelemetry()?.trackLocalMcpEvent({
      name: TelemetryEvents.LOCAL_MCP_PATH_SELECTED,
      properties: { client, action }
    })
  }

  async function inspectJob(jobId: string, session: number) {
    inFlightJobIds.add(jobId)
    let detail: JobDetail | undefined
    try {
      detail = await getJobDetail(jobId)
    } finally {
      if (session === watchSession) inFlightJobIds.delete(jobId)
    }
    if (session !== watchSession) return

    if (detail) {
      inspectedJobIds.add(jobId)
    } else {
      const attempts = (detailAttempts.get(jobId) ?? 0) + 1
      detailAttempts.set(jobId, attempts)
      if (attempts >= MAX_DETAIL_ATTEMPTS) inspectedJobIds.add(jobId)
      return
    }

    const source = readJobUsageSource(detail)
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
          if (inspectedJobIds.has(job.id) || inFlightJobIds.has(job.id))
            continue
          void inspectJob(job.id, watchSession)
        }
      },
      { immediate: true }
    )
  }

  function stopWatching() {
    stopQueueWatch?.()
    stopQueueWatch = undefined
    watchSession++
    inFlightJobIds.clear()
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
