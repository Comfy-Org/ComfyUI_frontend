/**
 * Agent log — streamed in real time to the Vite dev server's
 * /__agent-log endpoint, which appends each JSONL line to
 * ./tmp/agent-logs/<YYYY-MM-DD>.jsonl on the repo host.
 *
 * In production (no dev-plugin endpoint) the POST silently 404s and the
 * logger becomes a no-op. To persist in production a later backend
 * endpoint (or userdata fallback) would be needed.
 */
interface LogEntry {
  t: number
  kind: 'user' | 'assistant' | 'system' | 'tool' | 'error' | 'session'
  sessionId?: string
  text?: string
  script?: string
  stdout?: string
  stderr?: string
  exitCode?: number
}

const SESSION_ID =
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? (crypto as Crypto).randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10)

const ENDPOINT = '/__agent-log'

let queue: LogEntry[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null
let flushing = false
let disabled = false

async function doFlush(): Promise<void> {
  if (flushing || queue.length === 0 || disabled) return
  flushing = true
  const batch = queue.splice(0)
  const body = batch.map((e) => JSON.stringify(e)).join('\n') + '\n'
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-ndjson' },
      body,
      keepalive: true
    })
    if (res.status === 404) {
      // Endpoint doesn't exist (production build). Stop trying.
      disabled = true
    }
  } catch {
    // Keep the entries for a retry
    queue = batch.concat(queue)
  } finally {
    flushing = false
    if (queue.length > 0) schedule(400)
  }
}

function schedule(delay = 250): void {
  if (flushTimer || disabled) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    void doFlush()
  }, delay)
}

export function log(partial: Omit<LogEntry, 't' | 'sessionId'>): void {
  if (disabled) return
  queue.push({ t: Date.now(), sessionId: SESSION_ID, ...partial })
  schedule()
}

// Best-effort flush on tab close (uses navigator.sendBeacon-style fetch keepalive)
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    void doFlush()
  })
  // Mark session start
  log({ kind: 'session', text: 'session started' })
}
