import { useToastStore } from '@/platform/updates/common/toastStore'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'

const EXTENSION_NAME = 'Daydream.Streamer'
const CAMERA_CLASS = 'DaydreamCameraNode'
const STREAM_CLASS = 'DaydreamStreamNode'
const PREVIEW_CLASS = 'DaydreamStreamPreviewNode'
const ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }]

const CAMERA_INPUT = 'camera_stream'
const STREAM_INPUT = 'daydream_stream'

const toastStore = useToastStore()

type StreamListener = (stream: MediaStream | null) => void

type CameraState = {
  container: HTMLDivElement
  video: HTMLVideoElement
  startButton: HTMLButtonElement
  stopButton: HTMLButtonElement
  statusLabel: HTMLSpanElement
  localStream?: MediaStream
}

type StreamState = {
  nodeId: number
  container: HTMLDivElement
  startButton: HTMLButtonElement
  stopButton: HTMLButtonElement
  statusLabel: HTMLSpanElement
  isStarting?: boolean
  streamId?: string
  whepUrl?: string | null
  publishPc?: RTCPeerConnection
  playbackPc?: RTCPeerConnection
  cameraNodeId?: number | null
  cameraUnsub?: () => void
}

type PreviewState = {
  container: HTMLDivElement
  video: HTMLVideoElement
  unsubscribe?: () => void
}

const cameraNodeStates = new WeakMap<any, CameraState>()
const streamNodeStates = new WeakMap<any, StreamState>()
const previewNodeStates = new WeakMap<any, PreviewState>()

const cameraStreams = new Map<number, MediaStream>()
const cameraSubscribers = new Map<number, Set<StreamListener>>()

const remoteStreams = new Map<number, MediaStream | null>()
const remoteSubscribers = new Map<number, Set<StreamListener>>()

function setCameraStream(nodeId: number, stream: MediaStream | null) {
  if (stream) {
    cameraStreams.set(nodeId, stream)
  } else {
    cameraStreams.delete(nodeId)
  }
  const listeners = cameraSubscribers.get(nodeId)
  listeners?.forEach((cb) => cb(stream))
}

function subscribeCameraStream(nodeId: number, cb: StreamListener) {
  let listeners = cameraSubscribers.get(nodeId)
  if (!listeners) {
    listeners = new Set()
    cameraSubscribers.set(nodeId, listeners)
  }
  listeners.add(cb)
  cb(cameraStreams.get(nodeId) ?? null)
  return () => {
    listeners?.delete(cb)
    if (!listeners?.size) {
      cameraSubscribers.delete(nodeId)
    }
  }
}

function setRemoteStream(nodeId: number, stream: MediaStream | null) {
  if (stream) {
    remoteStreams.set(nodeId, stream)
  } else {
    remoteStreams.delete(nodeId)
  }
  const listeners = remoteSubscribers.get(nodeId)
  listeners?.forEach((cb) => cb(stream))
}

function subscribeRemoteStream(nodeId: number, cb: StreamListener) {
  let listeners = remoteSubscribers.get(nodeId)
  if (!listeners) {
    listeners = new Set()
    remoteSubscribers.set(nodeId, listeners)
  }
  listeners.add(cb)
  cb(remoteStreams.get(nodeId) ?? null)
  return () => {
    listeners?.delete(cb)
    if (!listeners?.size) {
      remoteSubscribers.delete(nodeId)
    }
  }
}

function getGraphLink(linkId: number) {
  const links = app.graph.links as Map<number, any> | Record<number, any>
  if (!links) return undefined
  if (typeof (links as Map<number, any>).get === 'function') {
    return (links as Map<number, any>).get(linkId)
  }
  return (links as Record<number, any>)[linkId]
}

function findLinkedNodeId(node: any, inputName: string): number | null {
  const slotIndex = node.inputs?.findIndex(
    (input: any) => input.name === inputName
  )
  if (slotIndex == null || slotIndex < 0) return null
  const slot = node.inputs[slotIndex]
  if (!slot?.link) return null
  const link = getGraphLink(slot.link)
  if (!link) return null
  return link.origin_id ?? null
}

function ensureCameraState(node: any): CameraState {
  let state = cameraNodeStates.get(node)
  if (state) return state

  const container = document.createElement('div')
  container.className = 'daydream-camera-node'
  container.style.display = 'flex'
  container.style.flexDirection = 'column'
  container.style.gap = '6px'
  container.style.padding = '8px'
  container.style.background = 'rgba(0,0,0,0.25)'
  container.style.borderRadius = '6px'

  const video = document.createElement('video')
  video.autoplay = true
  video.playsInline = true
  video.muted = true
  video.style.width = '100%'
  video.style.minHeight = '120px'
  video.style.background = 'rgba(255,255,255,0.05)'
  video.style.borderRadius = '4px'
  video.style.objectFit = 'cover'

  const controls = document.createElement('div')
  controls.style.display = 'flex'
  controls.style.alignItems = 'center'
  controls.style.gap = '6px'

  const startButton = document.createElement('button')
  startButton.textContent = 'Enable Camera'
  startButton.className = 'comfy-btn'

  const stopButton = document.createElement('button')
  stopButton.textContent = 'Disable'
  stopButton.className = 'comfy-btn'
  stopButton.disabled = true

  const statusLabel = document.createElement('span')
  statusLabel.textContent = 'Idle'
  statusLabel.style.fontSize = '0.85rem'
  statusLabel.style.opacity = '0.8'
  statusLabel.style.flex = '1'

  controls.append(startButton, stopButton, statusLabel)
  container.append(video, controls)

  const widget = node.addDOMWidget('daydream_camera', 'html', container)
  if (widget) {
    widget.computeSize = () => [300, 240]
    widget.serializeValue = () => undefined
  }

  state = { container, video, startButton, stopButton, statusLabel }
  cameraNodeStates.set(node, state)
  return state
}

function setCameraStatus(state: CameraState, text: string) {
  state.statusLabel.textContent = text
}

async function startCamera(node: any) {
  const state = ensureCameraState(node)
  if (state.localStream) return
  try {
    setCameraStatus(state, 'Requesting access...')
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false
    })
    state.localStream = stream
    state.video.srcObject = stream
    await state.video.play().catch(() => undefined)
    setCameraStatus(state, 'Streaming')
    state.startButton.disabled = true
    state.stopButton.disabled = false
    setCameraStream(node.id, stream)
  } catch (error) {
    console.error('[Daydream Camera] unable to start', error)
    const message =
      error instanceof Error ? error.message : 'Unable to access webcam.'
    toastStore.addAlert(message)
    setCameraStatus(state, 'Error')
  }
}

function stopCamera(node: any) {
  const state = ensureCameraState(node)
  if (state.localStream) {
    state.localStream.getTracks().forEach((track) => track.stop())
    state.localStream = undefined
  }
  state.video.srcObject = null
  state.startButton.disabled = false
  state.stopButton.disabled = true
  setCameraStatus(state, 'Idle')
  setCameraStream(node.id, null)
}

function ensureStreamState(node: any): StreamState {
  let state = streamNodeStates.get(node)
  if (state) return state

  const container = document.createElement('div')
  container.className = 'daydream-stream-node'
  container.style.display = 'flex'
  container.style.flexDirection = 'column'
  container.style.gap = '6px'
  container.style.padding = '8px'
  container.style.background = 'rgba(0,0,0,0.25)'
  container.style.borderRadius = '6px'

  const controls = document.createElement('div')
  controls.style.display = 'flex'
  controls.style.alignItems = 'center'
  controls.style.gap = '6px'

  const startButton = document.createElement('button')
  startButton.textContent = 'Start Stream'
  startButton.className = 'comfy-btn'

  const stopButton = document.createElement('button')
  stopButton.textContent = 'Stop'
  stopButton.className = 'comfy-btn'
  stopButton.disabled = true

  const statusLabel = document.createElement('span')
  statusLabel.textContent = 'Idle'
  statusLabel.style.flex = '1'
  statusLabel.style.fontSize = '0.85rem'
  statusLabel.style.opacity = '0.8'

  controls.append(startButton, stopButton, statusLabel)
  container.append(controls)

  const widget = node.addDOMWidget(
    'daydream_stream_controls',
    'html',
    container
  )
  if (widget) {
    widget.computeSize = () => [300, 80]
    widget.serializeValue = () => undefined
  }

  state = {
    nodeId: node.id,
    container,
    startButton,
    stopButton,
    statusLabel
  }
  streamNodeStates.set(node, state)
  return state
}

function setStreamStatus(state: StreamState, text: string) {
  state.statusLabel.textContent = text
}

function updateStreamButtons(state: StreamState) {
  const running = !!state.streamId
  state.startButton.disabled = state.isStarting || running
  state.stopButton.disabled = !running && !state.isStarting
}

function ensurePreviewState(node: any): PreviewState {
  let state = previewNodeStates.get(node)
  if (state) return state

  const container = document.createElement('div')
  container.className = 'daydream-preview-node'
  container.style.padding = '8px'
  container.style.background = 'rgba(0,0,0,0.25)'
  container.style.borderRadius = '6px'

  const video = document.createElement('video')
  video.autoplay = true
  video.playsInline = true
  video.controls = false
  video.style.width = '100%'
  video.style.minHeight = '150px'
  video.style.background = 'rgba(255,255,255,0.05)'
  video.style.borderRadius = '4px'
  video.style.objectFit = 'cover'

  container.append(video)

  const widget = node.addDOMWidget('daydream_preview', 'html', container)
  if (widget) {
    widget.computeSize = () => [300, 180]
    widget.serializeValue = () => undefined
  }

  state = { container, video }
  previewNodeStates.set(node, state)
  return state
}

function getWidgetByName(node: any, name: string) {
  return node.widgets?.find((widget: any) => widget.name === name)
}

function getStringValue(node: any, name: string, fallback = ''): string {
  const widget = getWidgetByName(node, name)
  if (widget?.value === undefined || widget?.value === null) {
    return fallback
  }
  return String(widget.value).trim()
}

function getNumberValue(node: any, name: string, fallback: number): number {
  const widget = getWidgetByName(node, name)
  const numeric = Number(widget?.value)
  return Number.isFinite(numeric) ? numeric : fallback
}

function getBooleanValue(node: any, name: string, fallback: boolean): boolean {
  const widget = getWidgetByName(node, name)
  const value = widget?.value
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string')
    return ['true', '1', 'on'].includes(value.toLowerCase())
  return fallback
}

async function waitForIceGathering(pc: RTCPeerConnection) {
  if (pc.iceGatheringState === 'complete') {
    return
  }
  await new Promise<void>((resolve) => {
    const checkState = () => {
      if (pc.iceGatheringState === 'complete') {
        pc.removeEventListener('icegatheringstatechange', checkState)
        resolve()
      }
    }
    pc.addEventListener('icegatheringstatechange', checkState)
  })
}

async function postSdp(streamId: string, path: 'whip' | 'whep', sdp: string) {
  const response = await api.fetchApi(
    `/daydream/streams/${streamId}/${path}/offer`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sdp })
    }
  )
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      `Daydream ${path.toUpperCase()} negotiation failed: ${response.status} ${errorText}`
    )
  }
  const data = await response.json()
  return data.sdp as string
}

async function pollForWhep(streamId: string | undefined, attempts = 6) {
  if (!streamId) return null
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await api.fetchApi(
        `/daydream/streams/${streamId}/status`
      )
      if (response.ok) {
        const payload = await response.json()
        const url = payload?.data?.gateway_status?.whep_url
        if (url) {
          return url as string
        }
      }
    } catch (error) {
      console.warn('[Daydream Stream] status polling failed', error)
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  return null
}

function buildControlnets(node: any) {
  const controlnets: any[] = []
  if (getBooleanValue(node, 'enable_depth_controlnet', true)) {
    controlnets.push({
      model_id: 'xinsir/controlnet-depth-sdxl-1.0',
      preprocessor: 'depth_tensorrt',
      conditioning_scale: getNumberValue(node, 'depth_controlnet_scale', 0.4),
      enabled: true,
      control_guidance_start: 0,
      control_guidance_end: 1,
      preprocessor_params: {}
    })
  }
  if (getBooleanValue(node, 'enable_canny_controlnet', true)) {
    controlnets.push({
      model_id: 'xinsir/controlnet-canny-sdxl-1.0',
      preprocessor: 'canny',
      conditioning_scale: getNumberValue(node, 'canny_controlnet_scale', 0.1),
      enabled: true,
      control_guidance_start: 0,
      control_guidance_end: 1,
      preprocessor_params: {}
    })
  }
  if (getBooleanValue(node, 'enable_tile_controlnet', true)) {
    controlnets.push({
      model_id: 'xinsir/controlnet-tile-sdxl-1.0',
      preprocessor: 'feedback',
      conditioning_scale: getNumberValue(node, 'tile_controlnet_scale', 0.1),
      enabled: true,
      control_guidance_start: 0,
      control_guidance_end: 1,
      preprocessor_params: {}
    })
  }
  return controlnets
}

async function createDaydreamStream(node: any, state: StreamState) {
  const apiKey = getStringValue(node, 'api_key')
  if (!apiKey) {
    throw new Error(
      'Add your Daydream API key on the Daydream Stream node before starting.'
    )
  }

  const tIndexListRaw = getStringValue(node, 't_index_list', '5,15,32')
  const tIndexList = tIndexListRaw
    .split(',')
    .map((value) => parseInt(value.trim(), 10))
    .filter((value) => Number.isFinite(value))
  if (!tIndexList.length) tIndexList.push(5, 15, 32)

  const params = {
    model_id: getStringValue(node, 'model_id', 'stabilityai/sdxl-turbo'),
    prompt: getStringValue(node, 'prompt', 'blooming flower'),
    negative_prompt:
      getStringValue(
        node,
        'negative_prompt',
        'blurry, low quality, flat, 2d'
      ) || undefined,
    width: getNumberValue(node, 'width', 512),
    height: getNumberValue(node, 'height', 512),
    seed: getNumberValue(node, 'seed', 789),
    delta: getNumberValue(node, 'delta', 0.7),
    guidance_scale: getNumberValue(node, 'guidance_scale', 1.0),
    num_inference_steps: getNumberValue(node, 'num_inference_steps', 50),
    t_index_list: tIndexList,
    use_lcm_lora: getBooleanValue(node, 'use_lcm_lora', true),
    lcm_lora_id: getStringValue(node, 'lcm_lora_id', '') || undefined,
    acceleration: 'tensorrt',
    enable_similar_image_filter: getBooleanValue(
      node,
      'enable_similar_image_filter',
      false
    ),
    similar_image_filter_threshold: getNumberValue(
      node,
      'similar_image_filter_threshold',
      0.98
    ),
    similar_image_filter_max_skip_frame: getNumberValue(
      node,
      'similar_image_filter_max_skip_frame',
      10
    ),
    prompt_interpolation_method: 'slerp',
    normalize_prompt_weights: true,
    normalize_seed_weights: true,
    use_safety_checker: true,
    use_denoising_batch: true,
    do_add_noise: true,
    seed_interpolation_method: 'linear',
    lora_dict: null,
    controlnets: buildControlnets(node),
    ip_adapter: getBooleanValue(node, 'enable_ip_adapter', true)
      ? {
          enabled: true,
          scale: getNumberValue(node, 'ip_adapter_scale', 0.5),
          type: 'regular',
          weight_type: 'linear'
        }
      : undefined,
    ip_adapter_style_image_url:
      getStringValue(
        node,
        'ip_adapter_style_image_url',
        'https://upload.wikimedia.org/wikipedia/commons/f/f0/Fractal_Xaos_psychedelic.png'
      ) || undefined
  }

  const response = await api.fetchApi('/daydream/streams', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      params,
      low_latency_mode: getBooleanValue(node, 'low_latency_mode', false)
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      `Daydream create-stream failed: ${response.status} ${errorText}`
    )
  }

  const payload = await response.json()
  state.streamId = payload.stream?.id
  state.whepUrl =
    payload.whep_url ||
    payload.status?.data?.gateway_status?.whep_url ||
    payload.stream?.output_stream_url ||
    null
  return payload
}

async function startPublishPeer(state: StreamState, cameraStream: MediaStream) {
  state.publishPc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
  cameraStream
    .getTracks()
    .forEach((track) => state.publishPc?.addTrack(track, cameraStream))

  const offer = await state.publishPc.createOffer({
    offerToReceiveVideo: false
  })
  await state.publishPc.setLocalDescription(offer)
  await waitForIceGathering(state.publishPc)
  const localSdp = state.publishPc.localDescription?.sdp
  if (!localSdp || !state.streamId) {
    throw new Error('Failed to gather local SDP for WHIP offer')
  }
  const answer = await postSdp(state.streamId, 'whip', localSdp)
  await state.publishPc.setRemoteDescription({ type: 'answer', sdp: answer })
}

async function startPlaybackPeer(state: StreamState) {
  if (!state.streamId || !state.whepUrl) return
  state.playbackPc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
  state.playbackPc.addTransceiver('video', { direction: 'recvonly' })
  state.playbackPc.ontrack = (event) => {
    const stream = event.streams?.[0]
    if (!stream) return
    setRemoteStream(state.nodeId, stream)
    void stream.getVideoTracks()?.[0]?.applyConstraints?.({})
  }

  const offer = await state.playbackPc.createOffer()
  await state.playbackPc.setLocalDescription(offer)
  await waitForIceGathering(state.playbackPc)
  const localSdp = state.playbackPc.localDescription?.sdp
  if (!localSdp) {
    throw new Error('Failed to gather local SDP for WHEP offer')
  }
  const answer = await postSdp(state.streamId, 'whep', localSdp)
  await state.playbackPc.setRemoteDescription({ type: 'answer', sdp: answer })
}

async function startDaydreamStream(node: any) {
  const state = ensureStreamState(node)
  if (state.streamId || state.isStarting) return

  const cameraNodeId = findLinkedNodeId(node, CAMERA_INPUT)
  if (cameraNodeId == null) {
    toastStore.addAlert(
      'Connect a Daydream Webcam node to the camera input before starting the stream.'
    )
    return
  }
  const cameraStream = cameraStreams.get(cameraNodeId)
  if (!cameraStream) {
    toastStore.addAlert('Enable the connected Daydream Webcam node first.')
    return
  }

  state.isStarting = true
  updateStreamButtons(state)
  setStreamStatus(state, 'Creating Daydream stream...')

  try {
    await createDaydreamStream(node, state)
    if (!state.streamId) {
      throw new Error('Daydream stream did not return an id.')
    }
    if (!state.whepUrl) {
      setStreamStatus(state, 'Waiting for output stream...')
      state.whepUrl = (await pollForWhep(state.streamId)) || null
    }

    await startPublishPeer(state, cameraStream)
    if (state.whepUrl) {
      setStreamStatus(state, 'Subscribing to output...')
      await startPlaybackPeer(state)
      setStreamStatus(state, 'Streaming live')
    } else {
      setStreamStatus(state, 'Publishing (output pending)')
    }

    state.cameraNodeId = cameraNodeId
    state.cameraUnsub = subscribeCameraStream(cameraNodeId, (stream) => {
      if (!stream && state.streamId) {
        toastStore.addAlert('Webcam stopped – stopping Daydream stream.')
        void stopDaydreamStream(node)
      }
    })
  } catch (error) {
    console.error('[Daydream Stream] start error', error)
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to start Daydream stream.'
    toastStore.addAlert(message)
    await stopDaydreamStream(node)
  } finally {
    state.isStarting = false
    updateStreamButtons(state)
  }
}

async function stopDaydreamStream(node: any) {
  const state = ensureStreamState(node)
  state.isStarting = false
  updateStreamButtons(state)

  state.cameraUnsub?.()
  state.cameraUnsub = undefined

  if (state.publishPc) {
    state.publishPc.getSenders().forEach((sender) => sender.track?.stop())
    state.publishPc.close()
    state.publishPc = undefined
  }
  if (state.playbackPc) {
    state.playbackPc.close()
    state.playbackPc = undefined
  }

  if (state.streamId) {
    try {
      await api.fetchApi(`/daydream/streams/${state.streamId}`, {
        method: 'DELETE'
      })
    } catch (error) {
      console.warn('[Daydream Stream] unable to delete stream', error)
    }
  }

  setRemoteStream(state.nodeId, null)
  state.streamId = undefined
  state.whepUrl = undefined
  state.cameraNodeId = undefined
  setStreamStatus(state, 'Idle')
}

function attachCameraNode(node: any) {
  const state = ensureCameraState(node)
  state.startButton.addEventListener('click', () => {
    void startCamera(node)
  })
  state.stopButton.addEventListener('click', () => {
    stopCamera(node)
  })

  const originalRemoved = node.onRemoved?.bind(node)
  node.onRemoved = function (...args: any[]) {
    stopCamera(node)
    cameraNodeStates.delete(node)
    originalRemoved?.(...args)
  }
}

function attachStreamNode(node: any) {
  const state = ensureStreamState(node)
  state.startButton.addEventListener('click', () => {
    void startDaydreamStream(node)
  })
  state.stopButton.addEventListener('click', () => {
    void stopDaydreamStream(node)
  })

  const originalRemoved = node.onRemoved?.bind(node)
  node.onRemoved = function (...args: any[]) {
    void stopDaydreamStream(node)
    streamNodeStates.delete(node)
    originalRemoved?.(...args)
  }
}

function attachPreviewNode(node: any) {
  const state = ensurePreviewState(node)

  const updateSubscription = () => {
    state.unsubscribe?.()
    const upstreamId = findLinkedNodeId(node, STREAM_INPUT)
    if (upstreamId == null) {
      state.video.srcObject = null
      return
    }
    state.unsubscribe = subscribeRemoteStream(upstreamId, (stream) => {
      if (!stream) {
        state.video.srcObject = null
        return
      }
      state.video.srcObject = stream
      void state.video.play().catch(() => undefined)
    })
  }

  updateSubscription()

  const originalConnections = node.onConnectionsChange?.bind(node)
  node.onConnectionsChange = function (...args: any[]) {
    originalConnections?.(...args)
    updateSubscription()
  }

  const originalRemoved = node.onRemoved?.bind(node)
  node.onRemoved = function (...args: any[]) {
    state.unsubscribe?.()
    state.unsubscribe = undefined
    previewNodeStates.delete(node)
    originalRemoved?.(...args)
  }
}

app.registerExtension({
  name: EXTENSION_NAME,
  nodeCreated(node) {
    const comfyClass = node.constructor?.comfyClass
    if (comfyClass === CAMERA_CLASS) {
      attachCameraNode(node)
    } else if (comfyClass === STREAM_CLASS) {
      attachStreamNode(node)
    } else if (comfyClass === PREVIEW_CLASS) {
      attachPreviewNode(node)
    }
  }
})
