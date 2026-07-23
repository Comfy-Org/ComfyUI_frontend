import { useChainCallback } from '@/composables/functional/useChainCallback'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ComfyNodeDef } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { app } from '@/scripts/app'
import { api } from '@/scripts/api'
import type {
  InteractionControl,
  InteractionMediaMetadata
} from '@/services/interactionProtocol'
import { MAX_INTERACTION_MEDIA_BYTES } from '@/services/interactionProtocol'
import {
  executionIdToNodeLocatorId,
  getNodeByLocatorId
} from '@/utils/graphTraversalUtil'

type Session = {
  node: LGraphNode
  definitionId: string
  element: HTMLElement
  video: HTMLVideoElement
  canvas: HTMLCanvasElement
  captureCanvas: HTMLCanvasElement
  status: HTMLElement
  stream?: MediaStream
  interactionId?: string
  promptId?: string
  seq: number
  capturing: boolean
  starting: boolean
  startGeneration: number
  lastResultSeq: number
  decodingResult: boolean
  pendingResult?: {
    metadata: InteractionMediaMetadata
    blob: Blob
  }
  nextCaptureAt: number
  captureTimer?: number
  pendingTerminalOp?: 'stop' | 'cancel'
  reconnectTimer?: number
  cleanupTimer?: number
  maxFrameBytes: number
  disposed: boolean
}

type InteractiveDefinition = NonNullable<ComfyNodeDef['interactive_ui']>[number]

const sessions = new Set<Session>()
const reconnectGraceMs = 6500
const terminalCleanupMs = 30_000

function clearTimer(timer: number | undefined) {
  if (timer !== undefined) window.clearTimeout(timer)
}

function stopCapture(session: Session) {
  session.stream?.getTracks().forEach((track) => track.stop())
  session.startGeneration++
  session.starting = false
  session.video.srcObject = null
  session.stream = undefined
  session.capturing = false
  clearTimer(session.captureTimer)
  session.captureTimer = undefined
}

function sendTerminal(session: Session, op: 'stop' | 'cancel') {
  stopCapture(session)
  if (!session.interactionId) return
  session.pendingTerminalOp = op
  api.sendInteractionControl({
    v: 1,
    op,
    interaction_id: session.interactionId,
    prompt_id: session.promptId
  })
}

function clearSession(session: Session) {
  stopCapture(session)
  session.interactionId = undefined
  session.promptId = undefined
  session.pendingTerminalOp = undefined
  session.pendingResult = undefined
  clearTimer(session.reconnectTimer)
  clearTimer(session.cleanupTimer)
  session.reconnectTimer = undefined
  session.cleanupTimer = undefined
}

function scheduleProtocolCleanup(session: Session) {
  clearTimer(session.cleanupTimer)
  session.cleanupTimer = window.setTimeout(() => {
    clearSession(session)
    if (session.disposed) sessions.delete(session)
  }, terminalCleanupMs)
}

function stopByUser(session: Session) {
  const wasStreaming = !!session.interactionId
  sendTerminal(session, 'stop')
  if (wasStreaming) {
    scheduleProtocolCleanup(session)
    session.status.textContent = 'Stream ended.'
  } else {
    session.status.textContent = 'Webcam stopped.'
  }
}

function sendReady(session: Session) {
  if (!session.interactionId) return
  api.sendInteractionControl({
    v: 1,
    op: 'ready',
    interaction_id: session.interactionId,
    prompt_id: session.promptId,
    width: 640,
    height: 480,
    fps: 10,
    mime: 'image/jpeg'
  })
}

function resendSessionState(session: Session) {
  if (!session.interactionId) return
  if (session.pendingTerminalOp) {
    api.sendInteractionControl({
      v: 1,
      op: session.pendingTerminalOp,
      interaction_id: session.interactionId,
      prompt_id: session.promptId
    })
    return
  }
  sendReady(session)
}

async function start(session: Session) {
  if (
    session.stream ||
    session.starting ||
    session.interactionId ||
    session.disposed
  )
    return
  if (!api.serverSupportsFeature('supports_interactions_v1')) {
    session.status.textContent = 'Interactive streaming is unavailable.'
    return
  }
  const generation = ++session.startGeneration
  session.starting = true
  let stream: MediaStream | undefined
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480 },
      audio: false
    })
    if (session.disposed || session.startGeneration !== generation) {
      stream.getTracks().forEach((track) => track.stop())
      return
    }
    session.stream = stream
    session.video.srcObject = stream
    stream.getVideoTracks().forEach((track) => {
      track.addEventListener('ended', () => {
        if (session.stream !== stream) return
        sendTerminal(session, 'stop')
        scheduleProtocolCleanup(session)
        session.status.textContent = 'Stream ended.'
      })
    })
    await session.video.play()
    session.status.textContent = 'Webcam ready. Queue the node to stream.'
  } catch {
    stream?.getTracks().forEach((track) => track.stop())
    if (session.stream === stream) {
      session.stream = undefined
      session.video.srcObject = null
    }
    session.status.textContent = 'Allow camera access to start.'
  } finally {
    if (session.startGeneration === generation) session.starting = false
  }
}

function waitForSocket() {
  return new Promise((resolve) => window.setTimeout(resolve, 50))
}

async function sendCapturedFrame(
  session: Session,
  interactionId: string,
  blob: Blob,
  captureTimestamp: number
) {
  const media = await blob.arrayBuffer()
  while (
    !session.disposed &&
    session.interactionId === interactionId &&
    session.stream
  ) {
    const metadata: InteractionMediaMetadata = {
      v: 1,
      interaction_id: interactionId,
      prompt_id: session.promptId,
      channel: 'source',
      seq: session.seq,
      capture_ts_ms: captureTimestamp,
      mime: 'image/jpeg'
    }
    if (api.sendInteractionMedia(metadata, media)) {
      session.seq++
      return
    }
    await waitForSocket()
  }
}

function capture(session: Session, interactionId: string) {
  if (
    session.capturing ||
    session.captureTimer !== undefined ||
    !session.stream ||
    session.interactionId !== interactionId
  )
    return
  const delay = session.nextCaptureAt - Date.now()
  if (delay > 0) {
    session.captureTimer = window.setTimeout(() => {
      session.captureTimer = undefined
      capture(session, interactionId)
    }, delay)
    return
  }
  session.nextCaptureAt = Date.now() + 100
  session.capturing = true
  session.captureCanvas
    .getContext('2d')
    ?.drawImage(session.video, 0, 0, 640, 480)
  const captureTimestamp = Date.now()
  session.captureCanvas.toBlob(
    async (blob) => {
      try {
        if (!blob) {
          sendTerminal(session, 'cancel')
          scheduleProtocolCleanup(session)
          session.status.textContent = 'Failed to capture webcam frame.'
          return
        }
        if (session.interactionId !== interactionId) return
        if (blob.size > session.maxFrameBytes) {
          sendTerminal(session, 'cancel')
          scheduleProtocolCleanup(session)
          session.status.textContent = 'Captured webcam frame is too large.'
          return
        }
        await sendCapturedFrame(session, interactionId, blob, captureTimestamp)
      } finally {
        session.capturing = false
      }
    },
    'image/jpeg',
    0.85
  )
}

function matchingSession(control: InteractionControl): Session | undefined {
  const active = [...sessions].find(
    (session) => session.interactionId === control.interaction_id
  )
  if (active) return active
  if (control.op !== 'open' && control.op !== 'resume') return
  const locatorId = control.display_node_id
    ? executionIdToNodeLocatorId(app.rootGraph, control.display_node_id)
    : undefined
  const node = locatorId
    ? getNodeByLocatorId(app.rootGraph, locatorId)
    : undefined
  return [...sessions].find(
    (session) =>
      !session.interactionId &&
      (session.node === node ||
        String(session.node.id) === control.display_node_id) &&
      (!control.group_id || session.definitionId === control.group_id)
  )
}

api.addEventListener('interaction', (event) => {
  const control = event.detail
  const session = matchingSession(control)
  if (!session) {
    if (control.op === 'open' || control.op === 'resume')
      api.sendInteractionControl({
        v: 1,
        op: 'cancel',
        interaction_id: control.interaction_id,
        prompt_id: control.prompt_id
      })
    return
  }
  if (session.promptId !== undefined && session.promptId !== control.prompt_id)
    return
  if (control.op === 'open' || control.op === 'resume') {
    clearTimer(session.reconnectTimer)
    session.reconnectTimer = undefined
    if (session.pendingTerminalOp) {
      resendSessionState(session)
      session.status.textContent = 'Stream ended.'
      return
    }
    if (!session.stream) {
      api.sendInteractionControl({
        v: 1,
        op: 'cancel',
        interaction_id: control.interaction_id,
        prompt_id: control.prompt_id
      })
      session.status.textContent =
        'Start the webcam, then queue the node again.'
      return
    }
    if (
      control.limits?.mime_types &&
      !control.limits.mime_types.includes('image/jpeg')
    ) {
      api.sendInteractionControl({
        v: 1,
        op: 'cancel',
        interaction_id: control.interaction_id,
        prompt_id: control.prompt_id
      })
      session.status.textContent = 'The stream does not support JPEG frames.'
      return
    }
    const isNewInteraction = session.interactionId === undefined
    session.promptId = control.prompt_id
    session.interactionId = control.interaction_id
    if (isNewInteraction) {
      session.lastResultSeq = -1
      session.maxFrameBytes = Math.min(
        control.limits?.max_frame_bytes ?? MAX_INTERACTION_MEDIA_BYTES,
        MAX_INTERACTION_MEDIA_BYTES
      )
    } else if (control.limits?.max_frame_bytes !== undefined) {
      session.maxFrameBytes = Math.min(
        control.limits.max_frame_bytes,
        MAX_INTERACTION_MEDIA_BYTES
      )
    }
    sendReady(session)
    session.status.textContent = 'Streaming'
  } else if (control.op === 'credit') {
    capture(session, control.interaction_id)
  } else {
    session.status.textContent =
      control.op === 'error'
        ? control.message || 'Stream failed.'
        : 'Stream ended.'
    clearSession(session)
    if (session.disposed) sessions.delete(session)
  }
})

async function displayPendingResult(session: Session) {
  if (session.decodingResult) return
  session.decodingResult = true
  try {
    while (session.pendingResult) {
      const { metadata, blob } = session.pendingResult
      session.pendingResult = undefined
      const interactionId = session.interactionId
      try {
        const bitmap = await createImageBitmap(blob)
        const context = session.canvas.getContext('2d')
        try {
          if (
            !context ||
            session.disposed ||
            session.interactionId !== interactionId ||
            metadata.seq <= session.lastResultSeq
          )
            continue
          session.canvas.width = bitmap.width
          session.canvas.height = bitmap.height
          context.drawImage(bitmap, 0, 0)
          session.lastResultSeq = metadata.seq
        } finally {
          bitmap.close()
        }
      } catch {
        session.status.textContent = 'Failed to display processed frame.'
      }
    }
  } finally {
    session.decodingResult = false
  }
}

api.addEventListener('interaction_media', (event) => {
  const { metadata, blob } = event.detail
  if (metadata.channel !== 'result') return
  const session = [...sessions].find(
    (candidate) => candidate.interactionId === metadata.interaction_id
  )
  if (
    !session ||
    (session.promptId !== undefined &&
      metadata.prompt_id !== undefined &&
      session.promptId !== metadata.prompt_id) ||
    blob.size > session.maxFrameBytes ||
    metadata.seq <= session.lastResultSeq ||
    (session.pendingResult &&
      metadata.seq <= session.pendingResult.metadata.seq)
  )
    return
  session.pendingResult = { metadata, blob }
  void displayPendingResult(session)
})

api.addEventListener('reconnecting', () => {
  sessions.forEach((session) => {
    if (!session.interactionId) return
    session.status.textContent = 'Reconnecting…'
    clearTimer(session.reconnectTimer)
    session.reconnectTimer = window.setTimeout(() => {
      if (!session.interactionId) return
      sendTerminal(session, 'cancel')
      scheduleProtocolCleanup(session)
      session.status.textContent = 'Stream ended after connection loss.'
    }, reconnectGraceMs)
  })
})

api.addEventListener('reconnected', () => {
  sessions.forEach((session) => {
    if (!session.interactionId) return
    session.status.textContent = 'Negotiating interaction support…'
  })
})

function createVideoStream(
  node: LGraphNode,
  definition: InteractiveDefinition
): Session {
  const element = document.createElement('div')
  element.className =
    'flex flex-col gap-2 rounded-lg bg-node-component-surface p-2'
  const surfaces = document.createElement('div')
  surfaces.className = 'grid grid-cols-2 gap-2'
  const source = document.createElement('div')
  const sourceLabel = document.createElement('div')
  sourceLabel.className = 'mb-1 text-muted-foreground'
  sourceLabel.textContent =
    definition.views.find((view) => view.role === 'local_source')?.label ?? ''
  const video = document.createElement('video')
  video.className = 'aspect-video w-full rounded bg-black object-contain'
  video.muted = true
  video.playsInline = true
  source.append(sourceLabel, video)
  const result = document.createElement('div')
  const resultLabel = document.createElement('div')
  resultLabel.className = 'mb-1 text-muted-foreground'
  resultLabel.textContent =
    definition.views.find((view) => view.role === 'remote_output')?.label ?? ''
  const canvas = document.createElement('canvas')
  canvas.className = 'aspect-video w-full rounded bg-black object-contain'
  const captureCanvas = document.createElement('canvas')
  captureCanvas.width = 640
  captureCanvas.height = 480
  result.append(resultLabel, canvas)
  surfaces.append(source, result)
  const controls = document.createElement('div')
  controls.className = 'flex items-center gap-2'
  const startButton = document.createElement('button')
  startButton.className = 'rounded bg-primary px-3 py-1 text-primary-foreground'
  startButton.textContent = 'Start Webcam'
  const stopButton = document.createElement('button')
  stopButton.className =
    'rounded bg-secondary px-3 py-1 text-secondary-foreground'
  stopButton.textContent = 'Stop Stream'
  const status = document.createElement('span')
  status.className = 'text-muted-foreground'
  status.textContent = api.serverSupportsFeature('supports_interactions_v1')
    ? 'Webcam stopped.'
    : 'Interactive streaming is unavailable.'
  controls.append(startButton, stopButton, status)
  element.append(surfaces, controls)
  const session: Session = {
    node,
    definitionId: definition.id,
    element,
    video,
    canvas,
    captureCanvas,
    status,
    seq: 0,
    capturing: false,
    starting: false,
    startGeneration: 0,
    lastResultSeq: -1,
    decodingResult: false,
    nextCaptureAt: 0,
    maxFrameBytes: MAX_INTERACTION_MEDIA_BYTES,
    disposed: false
  }
  function updateAvailability() {
    const available = api.serverSupportsFeature('supports_interactions_v1')
    startButton.disabled = !available
    if (session.reconnectTimer !== undefined && session.interactionId) {
      clearTimer(session.reconnectTimer)
      session.reconnectTimer = undefined
      if (available) {
        resendSessionState(session)
        session.status.textContent = session.pendingTerminalOp
          ? 'Stream ended.'
          : 'Streaming'
      } else {
        sendTerminal(session, 'cancel')
        scheduleProtocolCleanup(session)
        session.status.textContent = 'Interactive streaming is unavailable.'
      }
      return
    }
    if (!available && !session.interactionId && !session.stream)
      status.textContent = 'Interactive streaming is unavailable.'
    else if (
      available &&
      status.textContent === 'Interactive streaming is unavailable.'
    )
      status.textContent = 'Webcam stopped.'
  }
  api.addEventListener('feature_flags', updateAvailability)
  updateAvailability()
  startButton.addEventListener('click', () => void start(session))
  stopButton.addEventListener('click', () => stopByUser(session))
  session.element.addEventListener('interaction-dispose', () => {
    api.removeEventListener('feature_flags', updateAvailability)
  })
  return session
}

const renderers = new Map([['video_stream', createVideoStream]])

export function addInteractiveViews(node: LGraphNode, nodeDef: ComfyNodeDef) {
  for (const definition of nodeDef.interactive_ui ?? []) {
    const renderer = renderers.get(definition.kind)
    if (!renderer) continue
    const session = renderer(node, definition)
    sessions.add(session)
    const widget = node.addDOMWidget(
      `interactive:${definition.id}`,
      'interactive',
      session.element,
      {
        serialize: false,
        getMinHeight: () => 220,
        getValue: () => ''
      }
    )
    widget.serialize = false
    node.onRemoved = useChainCallback(node.onRemoved, () => {
      session.disposed = true
      session.element.dispatchEvent(new Event('interaction-dispose'))
      sendTerminal(session, 'stop')
      if (!session.interactionId) {
        clearSession(session)
        sessions.delete(session)
      } else {
        scheduleProtocolCleanup(session)
      }
    })
  }
}
