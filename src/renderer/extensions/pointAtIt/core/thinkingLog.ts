/** The thinking the model sent for one request, as far as it has arrived. */
export interface ThinkingLog {
  requestId: string
  text: string
  done: boolean
}

export type ThinkingEvent =
  | { type: 'started'; requestId: string }
  | { type: 'chunk'; requestId: string; text: string }
  | { type: 'finished'; requestId: string }
  | { type: 'cleared' }

/** Pure transition: text for a request other than the current one is dropped. */
export function reduceThinking(
  log: ThinkingLog | null,
  event: ThinkingEvent
): ThinkingLog | null {
  if (event.type === 'cleared') return null
  if (event.type === 'started')
    return { requestId: event.requestId, text: '', done: false }
  if (!log || log.requestId !== event.requestId || log.done) return log
  return event.type === 'chunk'
    ? { ...log, text: log.text + event.text }
    : { ...log, done: true }
}
