import { t } from '@/i18n'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useToast } from '@/components/ui/toast/toastStore'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'

import { api } from '../../scripts/api'
import { app } from '../../scripts/app'

const webcamReady = new WeakMap<LGraphNode, Promise<HTMLVideoElement>>()

app.registerExtension({
  name: 'Comfy.WebcamCapture',
  getCustomWidgets() {
    return {
      WEBCAM(node, inputName) {
        let resolveVideo: (video: HTMLVideoElement) => void = () => undefined
        webcamReady.set(
          node,
          new Promise((resolve) => (resolveVideo = resolve))
        )

        const container = document.createElement('div')
        container.style.background = 'rgba(0,0,0,0.25)'
        container.style.textAlign = 'center'

        const video = document.createElement('video')
        video.style.height = video.style.width = '100%'

        const loadVideo = async () => {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: false
            })
            container.replaceChildren(video)

            setTimeout(() => resolveVideo(video), 500) // Fallback as loadedmetadata doesnt fire sometimes?
            video.addEventListener(
              'loadedmetadata',
              () => resolveVideo(video),
              false
            )
            video.srcObject = stream
            await video.play()
          } catch (error) {
            const label = document.createElement('div')
            label.style.color = 'red'
            label.style.overflow = 'auto'
            label.style.maxHeight = '100%'
            label.style.whiteSpace = 'pre-wrap'

            const message =
              error instanceof Error ? error.message : String(error)
            if (window.isSecureContext) {
              label.textContent =
                'Unable to load webcam, please ensure access is granted:\n' +
                message
            } else {
              label.textContent =
                'Unable to load webcam. A secure context is required, if you are not accessing ComfyUI on localhost (127.0.0.1) you will have to enable TLS (https)\n\n' +
                message
            }

            container.replaceChildren(label)
          }
        }

        void loadVideo()

        return { widget: node.addDOMWidget(inputName, 'WEBCAM', container) }
      }
    }
  },
  nodeCreated(node: LGraphNode) {
    if ((node.type, node.constructor.comfyClass !== 'WebcamCapture')) return

    let video: HTMLVideoElement | undefined
    const camera = node.widgets?.find((w) => w.name === 'image')
    const w = node.widgets?.find((w) => w.name === 'width')
    const h = node.widgets?.find((w) => w.name === 'height')
    const captureOnQueue = node.widgets?.find(
      (w) => w.name === 'capture_on_queue'
    )
    if (!camera || !w || !h || !captureOnQueue) return

    const canvas = document.createElement('canvas')
    const nodeOutputStore = useNodeOutputStore()

    const capture = () => {
      if (
        !video ||
        typeof w.value !== 'number' ||
        typeof h.value !== 'number'
      ) {
        return
      }
      canvas.width = w.value
      canvas.height = h.value
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(video, 0, 0, w.value, h.value)
      const data = canvas.toDataURL('image/png')

      const img = new Image()
      img.onload = () => {
        node.imgs = [img]
        nodeOutputStore.setNodePreviewsByNodeId(node.id, [data])
        app.canvas.setDirty(true)
      }
      img.src = data
    }

    const btn = node.addWidget(
      'button',
      'waiting for camera...',
      'capture',
      capture,
      {}
    )
    btn.disabled = true
    btn.serializeValue = () => undefined

    camera.serializeValue = async () => {
      if (captureOnQueue.value) {
        capture()
      } else if (!node.imgs?.length) {
        const err = `No webcam image captured`
        useToast().warning('Alert', { description: err })
        throw new Error(err)
      }

      // Upload image to temp storage
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((blob) =>
          blob ? resolve(blob) : reject(new Error('Failed to capture webcam'))
        )
      )
      const name = `${+new Date()}.png`
      const file = new File([blob], name)
      const body = new FormData()
      body.append('image', file)
      body.append('subfolder', 'webcam')
      body.append('type', 'temp')
      const resp = await api.fetchApi('/upload/image', {
        method: 'POST',
        body
      })
      if (resp.status !== 200) {
        const err = `Error uploading camera image: ${resp.status} - ${resp.statusText}`
        useToast().warning('Alert', { description: err })
        throw new Error(err)
      }
      const data = await resp.json()
      const serverName = data.name || name
      const subfolder = data.subfolder || 'webcam'
      const type = data.type || 'temp'
      return `${subfolder}/${serverName} [${type}]`
    }

    const ready = webcamReady.get(node)
    if (!ready) return
    void ready.then((v) => {
      video = v
      // If width isn't specified then use video output resolution
      if (typeof w.value !== 'number' || !w.value) {
        w.value = video.videoWidth || 640
        h.value = video.videoHeight || 480
      }
      btn.disabled = false
      btn.label = t('g.capture')
    })
  }
})
