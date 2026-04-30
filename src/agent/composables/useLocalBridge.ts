import { onMounted, onUnmounted, ref } from 'vue'

import { useAgentSession } from './useAgentSession'

const DAEMON_WS = 'ws://127.0.0.1:7437/spa'
const PROTOCOL_VERSION = 1
const SESSION_ID = crypto.randomUUID()

type SpaToDaemon =
  | { v: number; type: 'hello'; sessionId: string; title?: string }
  | {
      v: number
      type: 'evalResult'
      sessionId: string
      opId: string
      stdout: string
      stderr?: string
      exitCode: number
    }
  | { v: number; type: 'pair-request'; sessionId: string; code: string }
  | { v: number; type: 'pong'; sessionId: string }

type DaemonToSpa =
  | { v: number; type: 'send'; text: string }
  | { v: number; type: 'eval'; opId: string; script: string }
  | { v: number; type: 'abort' }
  | { v: number; type: 'paired'; code: string }
  | { v: number; type: 'ping' }

// Singleton state — shared across all callers of useLocalBridge()
const connected = ref(false)
const activePairCode = ref<string | null>(null)

let ws: WebSocket | null = null
let refCount = 0
let sendFn: ((text: string) => void) | null = null
let evalFn:
  | ((
      opId: string,
      script: string
    ) => Promise<{ stdout: string; stderr?: string; exitCode: number }>)
  | null = null
let stopFn: (() => void) | null = null

function sendMsg(msg: SpaToDaemon) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
}

function connect(
  onSend: typeof sendFn,
  onEval: typeof evalFn,
  onStop: typeof stopFn
) {
  sendFn = onSend
  evalFn = onEval
  stopFn = onStop
  if (ws && ws.readyState !== WebSocket.CLOSED) return

  ws = new WebSocket(DAEMON_WS)

  ws.addEventListener('open', () => {
    connected.value = true
    sendMsg({
      v: PROTOCOL_VERSION,
      type: 'hello',
      sessionId: SESSION_ID,
      title: 'ComfyUI'
    })
  })

  ws.addEventListener('message', async (ev) => {
    let msg: DaemonToSpa
    try {
      msg = JSON.parse(ev.data as string) as DaemonToSpa
    } catch {
      return
    }
    if (msg.v !== PROTOCOL_VERSION) return

    switch (msg.type) {
      case 'ping':
        sendMsg({ v: PROTOCOL_VERSION, type: 'pong', sessionId: SESSION_ID })
        break
      case 'send':
        sendFn?.(msg.text)
        break
      case 'eval': {
        const result = (await evalFn?.(msg.opId, msg.script)) ?? {
          stdout: '',
          exitCode: 0
        }
        sendMsg({
          v: PROTOCOL_VERSION,
          type: 'evalResult',
          sessionId: SESSION_ID,
          opId: msg.opId,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode
        })
        break
      }
      case 'abort':
        stopFn?.()
        break
      case 'paired':
        if (activePairCode.value === msg.code) activePairCode.value = null
        break
    }
  })

  ws.addEventListener('close', () => {
    connected.value = false
    ws = null
    // Reconnect after 3s if still mounted
    if (refCount > 0)
      setTimeout(() => {
        if (refCount > 0) connect(sendFn, evalFn, stopFn)
      }, 3000)
  })

  ws.addEventListener('error', () => {
    connected.value = false
  })
}

function disconnect() {
  refCount--
  if (refCount <= 0) {
    ws?.close()
    ws = null
    refCount = 0
    connected.value = false
  }
}

/** Mount in the root component (AgentRoot) to manage the WS lifecycle. */
export function useLocalBridge() {
  const { send, stop, execShell } = useAgentSession()

  onMounted(() => {
    refCount++
    connect(
      (text) => void send(text, []),
      (_opId, script) => execShell(script),
      () => stop()
    )
  })

  onUnmounted(disconnect)
}

function requestPair(): void {
  const code = Math.random().toString(36).slice(2, 8).toUpperCase()
  activePairCode.value = code
  sendMsg({
    v: PROTOCOL_VERSION,
    type: 'pair-request',
    sessionId: SESSION_ID,
    code
  })
}

/** Read bridge state from any component — no lifecycle side-effects. */
export function useBridgeStatus() {
  return { connected, activePairCode, requestPair }
}
