import { useEventListener } from '@vueuse/core'
import { ref } from 'vue'

import { LogsWsMessage } from '@/schemas/apiSchema'
import { api } from '@/scripts/api'
import { components } from '@/types/generatedManagerTypes'

const LOGS_MESSAGE_TYPE = 'logs'
const MANAGER_WS_TASK_DONE_NAME = 'cm-task-completed'

type ManagerWsTaskDoneMsg = components['schemas']['MessageTaskDone']

interface UseServerLogsOptions {
  ui_id: string
  immediate?: boolean
  messageFilter?: (message: string) => boolean
}

export const useServerLogs = (options: UseServerLogsOptions) => {
  const {
    immediate = false,
    messageFilter = (msg: string) => Boolean(msg.trim())
  } = options

  const logs = ref<string[]>([])
  let stopLogs: ReturnType<typeof useEventListener> | null = null
  let stopTaskDone: ReturnType<typeof useEventListener> | null = null

  const isValidLogEvent = (event: CustomEvent<LogsWsMessage>) =>
    event?.type === LOGS_MESSAGE_TYPE && event.detail?.entries?.length > 0

  const parseLogMessage = (event: CustomEvent<LogsWsMessage>) =>
    event.detail.entries.map((e) => e.m).filter(messageFilter)

  const handleLogMessage = (event: CustomEvent<LogsWsMessage>) => {
    if (isValidLogEvent(event)) {
      const messages = parseLogMessage(event)
      if (messages.length > 0) {
        logs.value.push(...messages)
      }
    }
  }

  const handleTaskDone = (event: CustomEvent<ManagerWsTaskDoneMsg>) => {
    if (event?.type === MANAGER_WS_TASK_DONE_NAME) {
      const { state } = event.detail
      // Check if our task is now in the history (completed)
      if (state.history[options.ui_id]) {
        void stopListening()
      }
    }
  }

  const startListening = async () => {
    await api.subscribeLogs(true)
    stopLogs = useEventListener(api, LOGS_MESSAGE_TYPE, handleLogMessage)
    stopTaskDone = useEventListener(
      api,
      MANAGER_WS_TASK_DONE_NAME,
      handleTaskDone
    )
  }

  const stopListening = async () => {
    console.log('stopListening')
    stopLogs?.()
    stopTaskDone?.()
    stopLogs = null
    stopTaskDone = null
    await api.subscribeLogs(false)
  }

  if (immediate) {
    void startListening()
  }

  const cleanup = async () => {
    await stopListening()
    logs.value = []
  }

  return {
    logs,
    startListening,
    stopListening,
    cleanup
  }
}
