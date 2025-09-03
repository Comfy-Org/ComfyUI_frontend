import { useEventListener } from '@vueuse/core'
import { onUnmounted, ref } from 'vue'

import { LogsWsMessage } from '@/schemas/apiSchema'
import { api } from '@/scripts/api'

const LOGS_MESSAGE_TYPE = 'logs'

interface UseServerLogsOptions {
  immediate?: boolean
  messageFilter?: (message: string) => boolean
}

export const useServerLogs = (options: UseServerLogsOptions = {}) => {
  const {
    immediate = false,
    messageFilter = (msg: string) => Boolean(msg.trim())
  } = options

  const logs = ref<string[]>([])
  let stop: ReturnType<typeof useEventListener> | null = null

  const isValidLogEvent = (event: CustomEvent<LogsWsMessage>) =>
    event?.type === LOGS_MESSAGE_TYPE && event.detail?.entries?.length > 0

  const parseLogMessage = (event: CustomEvent<LogsWsMessage>) =>
    event.detail.entries.map((e) => e.m).filter(messageFilter)

  const handleLogMessage = (event: CustomEvent<LogsWsMessage>) => {
    if (isValidLogEvent(event)) {
      logs.value.push(...parseLogMessage(event))
    }
  }

  const start = async () => {
    await api.subscribeLogs(true)
    stop = useEventListener(api, LOGS_MESSAGE_TYPE, handleLogMessage)
  }

  const stopListening = async () => {
    stop?.()
    stop = null
    await api.subscribeLogs(false)
  }

  if (immediate) {
    void start()
  }

  onUnmounted(async () => {
    await stopListening()
    logs.value = []
  })

  return {
    logs,
    startListening: start,
    stopListening
  }
}
