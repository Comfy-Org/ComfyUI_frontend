/**
 * ComfyUI Desktop — Debug Activity Logger
 *
 * Centralized logging for execution pipeline tracking.
 * Logs: HTTP calls, WebSocket messages, node execution, model loading, timing.
 *
 * Enable via: window.__COMFY_DEBUG = true
 * Or set URL param: ?debug=1
 */

declare global {
  interface Window {
    __COMFY_DEBUG?: boolean
  }
}

const urlParams = new URLSearchParams(window.location.search)
const DEBUG_ENABLED =
  urlParams.get('debug') === '1' ||
  urlParams.get('debug') === 'true' ||
  window.__COMFY_DEBUG === true

const START_TIME = performance.now()

interface TimingEntry {
  label: string
  start: number
  end?: number
}

const timings: Map<string, TimingEntry> = new Map()

function elapsed(): string {
  return ((performance.now() - START_TIME) / 1000).toFixed(3) + 's'
}

function log(category: string, icon: string, message: string, data?: unknown) {
  if (!DEBUG_ENABLED) return
  const ts = elapsed()
  const prefix = `${icon} [${ts}] [${category}]`
  if (data !== undefined) {
    console.log(`${prefix} ${message}`, data)
  } else {
    console.log(`${prefix} ${message}`)
  }
}

// ─── Timing ───────────────────────────────────────────────────────────────────

export function startTiming(label: string) {
  if (!DEBUG_ENABLED) return
  timings.set(label, { label, start: performance.now() })
  log('TIMING', '⏱️', `START: ${label}`)
}

export function endTiming(label: string): number | undefined {
  if (!DEBUG_ENABLED) return undefined
  const entry = timings.get(label)
  if (!entry) return undefined
  entry.end = performance.now()
  const duration = entry.end - entry.start
  log('TIMING', '⏱️', `END: ${label} (${duration.toFixed(1)}ms)`)
  return duration
}

// ─── HTTP API Calls ───────────────────────────────────────────────────────────

export function logHttpRequest(method: string, url: string, body?: unknown) {
  log(
    'HTTP',
    '🌐',
    `${method} ${url}`,
    body ? truncate(JSON.parse(JSON.stringify(body)), 500) : undefined
  )
}

export function logHttpResponse(
  method: string,
  url: string,
  status: number,
  duration: number,
  body?: unknown
) {
  const icon = status >= 400 ? '❌' : '✅'
  log(
    'HTTP',
    icon,
    `${method} ${url} → ${status} (${duration.toFixed(0)}ms)`,
    body ? truncate(body, 500) : undefined
  )
}

// ─── WebSocket Messages ───────────────────────────────────────────────────────

export function logWebSocketOpen(url: string) {
  log('WS', '🔌', `Connected: ${url}`)
}

export function logWebSocketClose(code: number, reason: string) {
  log('WS', '🔴', `Disconnected: code=${code} reason=${reason}`)
}

export function logWebSocketMessage(type: string, data: unknown) {
  const icon = getWsIcon(type)
  log('WS', icon, `← ${type}`, truncate(data, 300))
}

export function logWebSocketSend(type: string, data?: unknown) {
  log('WS', '📤', `→ ${type}`, data ? truncate(data, 300) : undefined)
}

// ─── Queue Prompt Flow ────────────────────────────────────────────────────────

export function logQueuePromptStart(requestId: string, nodeCount: number) {
  log(
    'QUEUE',
    '🚀',
    `Queue Prompt START (requestId=${requestId}, nodes=${nodeCount})`
  )
}

export function logQueuePromptApiCall(promptId: string) {
  log('QUEUE', '📡', `POST /api/prompt → prompt_id=${promptId}`)
}

export function logQueuePromptStored(jobId: string, nodeCount: number) {
  log('QUEUE', '📋', `Job stored: id=${jobId}, nodes=${nodeCount}`)
}

// ─── Execution Pipeline ───────────────────────────────────────────────────────

export function logExecutionStart(promptId: string) {
  log('EXEC', '🎬', `Execution START: prompt_id=${promptId}`)
}

export function logExecutingNode(nodeId: string | null, promptId: string) {
  if (nodeId === null) {
    log('EXEC', '🏁', `Execution COMPLETE: prompt_id=${promptId}`)
  } else {
    log('EXEC', '⚙️', `Executing node: ${nodeId}`)
  }
}

export function logNodeExecuted(nodeId: string, output?: unknown) {
  log(
    'EXEC',
    '✅',
    `Node executed: ${nodeId}`,
    output ? truncate(output, 200) : undefined
  )
}

export function logNodeCached(nodeIds: string[]) {
  log('EXEC', '💾', `Cached nodes: ${nodeIds.join(', ')}`)
}

export function logExecutionSuccess(promptId: string) {
  log('EXEC', '🎉', `Execution SUCCESS: prompt_id=${promptId}`)
}

export function logExecutionError(promptId: string, error: unknown) {
  log('EXEC', '❌', `Execution ERROR: prompt_id=${promptId}`, error)
}

export function logExecutionInterrupted(promptId: string) {
  log('EXEC', '🛑', `Execution INTERRUPTED: prompt_id=${promptId}`)
}

// ─── Progress ─────────────────────────────────────────────────────────────────

export function logProgress(nodeId: string, value: number, max: number) {
  const pct = ((value / max) * 100).toFixed(1)
  log('PROG', '📊', `Node ${nodeId}: ${value}/${max} (${pct}%)`)
}

export function logProgressState(nodes: Record<string, unknown>) {
  const summary = Object.entries(nodes)
    .map(([id, n]) => {
      const node = n as Record<string, unknown>
      return `${id}:${String(node.state ?? 'unknown')}`
    })
    .join(', ')
  log('PROG', '📊', `Progress state: ${summary}`)
}

export function logProgressText(nodeId: string, text: string) {
  log('PROG', '💬', `Node ${nodeId} text: ${text}`)
}

// ─── Status ───────────────────────────────────────────────────────────────────

export function logStatus(queueRemaining: number, sessionId: string) {
  log(
    'STATUS',
    '📌',
    `Status: queue_remaining=${queueRemaining}, session=${sessionId}`
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getWsIcon(type: string): string {
  switch (type) {
    case 'execution_start':
      return '🎬'
    case 'executing':
      return '⚙️'
    case 'progress':
    case 'progress_state':
      return '📊'
    case 'executed':
      return '✅'
    case 'execution_cached':
      return '💾'
    case 'execution_success':
      return '🎉'
    case 'execution_error':
      return '❌'
    case 'execution_interrupted':
      return '🛑'
    case 'status':
      return '📌'
    case 'progress_text':
      return '💬'
    default:
      return '📨'
  }
}

function truncate(obj: unknown, maxLen: number): unknown {
  if (obj === null || obj === undefined) return obj
  const str = typeof obj === 'string' ? obj : JSON.stringify(obj)
  if (str.length <= maxLen) return obj
  return str.slice(0, maxLen) + `... (${str.length} chars total)`
}
