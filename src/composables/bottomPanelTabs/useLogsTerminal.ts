import { until, useEventListener } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import type { Ref } from 'vue'
import { onMounted, onScopeDispose, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { LogEntry, LogsWsMessage } from '@/schemas/apiSchema'
import { api } from '@/scripts/api'
import { useExecutionStore } from '@/stores/executionStore'

type TerminalLike = {
  write: (data: string) => void
  reset: () => void
  scrollToBottom: () => void
}

/**
 * Drives the built-in logs terminal: initial load, live `logs` stream, and
 * full resync when the backend WebSocket reconnects (e.g., after a reboot).
 *
 * Listeners are registered synchronously so we cannot miss a `reconnected`
 * event during the mount-time fetch/subscribe awaits. In-flight fetches are
 * tied to AbortControllers so that:
 *   - rapid double-reconnects don't interleave writes / double-subscribe
 *   - unmount mid-fetch never writes to a disposed terminal
 */
export function useLogsTerminal(
  terminal: Readonly<Ref<TerminalLike | undefined>>
) {
  const { t } = useI18n()
  const errorMessage = ref('')
  const loading = ref(true)

  let mountController: AbortController | undefined
  let resyncController: AbortController | undefined

  const writeEntries = (entries: LogEntry[]) => {
    terminal.value?.write(entries.map((e) => e.m).join(''))
  }

  const resyncLogs = async () => {
    // Cancel both the in-flight mount fetch and any prior resync so a late
    // mount response can't write a stale snapshot on top of a freshly-reset
    // terminal after we've already written the post-reconnect view.
    mountController?.abort()
    resyncController?.abort()
    const controller = new AbortController()
    resyncController = controller
    const { signal } = controller

    try {
      const logs = await api.getRawLogs()
      if (signal.aborted || !terminal.value) return
      terminal.value.reset()
      writeEntries(logs.entries)
      terminal.value.scrollToBottom()
      // Backend lost the per-client log subscription across the restart;
      // re-subscribe so new runtime logs stream over the fresh WebSocket.
      await api.subscribeLogs(true)
      if (signal.aborted) return
      errorMessage.value = ''
      loading.value = false
    } catch (err) {
      if (signal.aborted) return
      console.error('Error resyncing logs after reconnect', err)
      errorMessage.value = t('logsTerminal.resyncError')
    }
  }

  // Register listeners synchronously, before any awaits, so a reconnect
  // fired during mount cannot be missed. useEventListener handles cleanup
  // on scope dispose.
  useEventListener(api, 'logs', (e: CustomEvent<LogsWsMessage>) => {
    writeEntries(e.detail.entries)
  })
  useEventListener(api, 'reconnected', () => {
    void resyncLogs()
  })

  onMounted(async () => {
    if (!terminal.value) await until(terminal).toBeTruthy()

    const controller = new AbortController()
    mountController = controller
    const { signal } = controller

    try {
      const logs = await api.getRawLogs()
      if (signal.aborted || !terminal.value) return
      writeEntries(logs.entries)
    } catch (err) {
      if (signal.aborted) return
      console.error('Error loading logs', err)
      errorMessage.value = t('logsTerminal.loadError')
      loading.value = false
      return
    }

    const { clientId } = storeToRefs(useExecutionStore())
    if (!clientId.value) await until(clientId).not.toBeNull()
    if (signal.aborted) return

    try {
      await api.subscribeLogs(true)
    } catch (err) {
      if (signal.aborted) return
      console.error('Error subscribing to logs', err)
    }

    if (!signal.aborted) loading.value = false
  })

  onScopeDispose(() => {
    mountController?.abort()
    resyncController?.abort()
    if (!api.clientId) return
    api.subscribeLogs(false).catch((err) => {
      console.error('Error unsubscribing from logs', err)
    })
  })

  return { errorMessage, loading }
}
