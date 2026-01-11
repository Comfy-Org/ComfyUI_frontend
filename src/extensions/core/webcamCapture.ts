import { t } from '@/i18n'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { INumericWidget } from '@/lib/litegraph/src/types/widgets'
import { useToastStore } from '@/platform/updates/common/toastStore'

import { api } from '../../scripts/api'
import { app } from '../../scripts/app'

const WEBCAM_READY = Symbol()

interface WebcamNode extends LGraphNode {
  [WEBCAM_READY]?: Promise<HTMLVideoElement>
}

app.registerExtension({
  name: 'Comfy.WebcamCapture',
  getCustomWidgets() {
    return {
      WEBCAM(node: WebcamNode, inputName: string) {
        let resolveVideo: (video: HTMLVideoElement) => void
        node[WEBCAM_READY] = new Promise((resolve) => {
          resolveVideo = resolve
        })

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
            video.play()
          } catch (error) {
            const label = document.createElement('div')
            label.style.color = 'red'
            label.style.overflow = 'auto'
            label.style.maxHeight = '100%'
            label.style.whiteSpace = 'pre-wrap'

            const errorMessage =
              error instanceof Error ? error.message : String(error)
            if (window.isSecureContext) {
              label.textContent =
                'Unable to load webcam, please ensure access is granted:\n' +
                errorMessage
            } else {
              label.textContent =
                'Unable to load webcam. A secure context is required, if you are not accessing ComfyUI on localhost (127.0.0.1) you will have to enable TLS (https)\n\n' +
                errorMessage
            }

            container.replaceChildren(label)
          }
        }

        loadVideo()

        return { widget: node.addDOMWidget(inputName, 'WEBCAM', container) }
      }
    }
  },
  nodeCreated(node: WebcamNode) {
    if ((node.type, node.constructor.comfyClass !== 'WebcamCapture')) return

    let video: HTMLVideoElement | undefined
    const camera = node.widgets?.find((w) => w.name === 'image')
    const widthWidget = node.widgets?.find((w) => w.name === 'width') as
      | INumericWidget
      | undefined
    const heightWidget = node.widgets?.find((w) => w.name === 'height') as
      | INumericWidget
      | undefined
    const captureOnQueue = node.widgets?.find(
      (w) => w.name === 'capture_on_queue'
    )

    const canvas = document.createElement('canvas')

    const capture = () => {
      if (!widthWidget || !heightWidget || !video) return
      const width = widthWidget.value ?? 640
      const height = heightWidget.value ?? 480
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx?.drawImage(video, 0, 0, width, height)
      const data = canvas.toDataURL('image/png')

      const img = new Image()
      img.onload = () => {
        node.imgs = [img]
        app.canvas.setDirty(true)
      }
      img.src = data
    }

    const btn = node.addWidget(
      'button',
      'waiting for camera...',
      'capture',
      capture,
      { canvasOnly: true }
    )
    btn.disabled = true
    btn.serializeValue = () => undefined

    if (camera) {
      camera.serializeValue = async () => {
        if (captureOnQueue?.value) {
          capture()
        } else if (!node.imgs?.length) {
          const err = `No webcam image captured`
          useToastStore().addAlert(err)
          throw new Error(err)
        }

        // Upload image to temp storage
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No blob'))))
        })
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
          useToastStore().addAlert(err)
          throw new Error(err)
        }
        return `webcam/${name} [temp]`
      }
    }

    node[WEBCAM_READY]?.then((v) => {
      video = v
      // If width isn't specified then use video output resolution
      if (widthWidget && !widthWidget.value) {
        widthWidget.value = video.videoWidth || 640
      }
      if (heightWidget && !heightWidget.value) {
        heightWidget.value = video.videoHeight || 480
      }
      btn.disabled = false
      btn.label = t('g.capture')
    })
  }
})
