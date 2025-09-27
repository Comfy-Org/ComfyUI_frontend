/**
 * LiteGraph Audio Widget Factory
 * Creates full DOM-based audio widgets with rich functionality
 */
import { MediaRecorder as ExtendableMediaRecorder } from 'extendable-media-recorder'

import { useChainCallback } from '@/composables/functional/useChainCallback'
import { useNodeDragAndDrop } from '@/composables/node/useNodeDragAndDrop'
import { useNodeFileInput } from '@/composables/node/useNodeFileInput'
import { useNodePaste } from '@/composables/node/useNodePaste'
import { t } from '@/i18n'
import { type LGraphNode } from '@/lib/litegraph/src/litegraph'
import type {
  IBaseWidget,
  IStringWidget
} from '@/lib/litegraph/src/types/widgets'
import { useToastStore } from '@/platform/updates/common/toastStore'
import type { DOMWidget } from '@/scripts/domWidget'
import { useAudioService } from '@/services/audioService'
import { vueWidgetSerializationStore } from '@/stores/vueWidgetSerializationStore'
import { getNodeByLocatorId } from '@/utils/graphTraversalUtil'

import { api } from '../../../scripts/api'
import { app } from '../../../scripts/app'
import type {
  AudioWidgetFactory,
  WidgetCreationResult
} from './AudioWidgetFactory'

export class LiteGraphAudioWidgetFactory implements AudioWidgetFactory {
  beforeRegisterNodeDef(nodeType: any, nodeData: any): void {
    // Add audioUI widget requirement for audio nodes
    if (
      [
        'LoadAudio',
        'SaveAudio',
        'PreviewAudio',
        'SaveAudioMP3',
        'SaveAudioOpus',
        'RecordAudio'
      ].includes(nodeType.prototype?.comfyClass)
    ) {
      nodeData.input.required.audioUI = ['AUDIO_UI', {}]
    }

    // Add upload widget requirement for nodes with audio_upload flag
    if (nodeData?.input?.required?.audio?.[1]?.audio_upload === true) {
      nodeData.input.required.upload = ['AUDIOUPLOAD', {}]
    }
  }

  createAudioUI(node: LGraphNode, inputName: string): WidgetCreationResult {
    // Create DOM audio element
    const audio = document.createElement('audio')
    audio.controls = true
    audio.classList.add('comfy-audio')
    audio.setAttribute('name', 'media')

    const audioUIWidget: DOMWidget<HTMLAudioElement, string> =
      node.addDOMWidget(inputName, 'audioUI', audio)
    audioUIWidget.serialize = false

    const { nodeData } = node.constructor
    if (nodeData == null) throw new TypeError('nodeData is null')

    const isOutputNode = nodeData.output_node
    if (isOutputNode) {
      // Hide the audio widget when there is no audio initially
      audioUIWidget.element.classList.add('empty-audio-widget')

      // Populate the audio widget UI on node execution
      const onExecuted = node.onExecuted
      const factory = this // Capture factory reference for callback
      node.onExecuted = function (message: any) {
        // @ts-expect-error fixme ts strict error
        onExecuted?.apply(this, arguments)
        const audios = message.audio
        if (!audios) return
        const audio = audios[0]
        audioUIWidget.element.src = api.apiURL(
          factory.getResourceURL(audio.subfolder, audio.filename, audio.type)
        )
        audioUIWidget.element.classList.remove('empty-audio-widget')
      }
    }

    audioUIWidget.onRemove = useChainCallback(audioUIWidget.onRemove, () => {
      if (!audioUIWidget.element) return
      audioUIWidget.element.pause()
      audioUIWidget.element.src = ''
      audioUIWidget.element.remove()
    })

    // Add serialization support for RecordAudio nodes
    if ((node.constructor as any).comfyClass === 'RecordAudio') {
      const nodeId = node.id
      audioUIWidget.serializeValue = async () => {
        let serializationFn = vueWidgetSerializationStore.get(
          `${nodeId}-audioUI`
        )

        // Fallback: try with current node.id in case it changed
        if (!serializationFn && node.id !== nodeId) {
          serializationFn = vueWidgetSerializationStore.get(
            `${node.id}-audioUI`
          )
        }

        if (serializationFn) {
          const result = await serializationFn()

          // Update both LiteGraph widgets for consistency
          const audioWidget = node.widgets?.find((w) => w.name === 'audio')
          const audioUIWidget = node.widgets?.find((w) => w.name === 'audioUI')

          if (audioWidget && result) {
            audioWidget.value = result
          }
          if (audioUIWidget && result) {
            audioUIWidget.value = result
          }

          return result
        }

        return ''
      }
    }

    return { widget: audioUIWidget }
  }

  createAudioUpload(node: LGraphNode, inputName: string): WidgetCreationResult {
    // Find the related audio widgets
    const audioWidget = node.widgets?.find(
      (w) => w.name === 'audio'
    ) as IStringWidget
    const audioUIWidget = node.widgets?.find(
      (w) => w.name === 'audioUI'
    ) as unknown as DOMWidget<HTMLAudioElement, string>

    const factory = this // Capture factory reference
    const onAudioWidgetUpdate = () => {
      audioUIWidget.element.src = api.apiURL(
        factory.getResourceURL(
          ...factory.splitFilePath(audioWidget.value as string)
        )
      )
    }

    // Initially load default audio file to audioUIWidget
    if (audioWidget.value) {
      onAudioWidgetUpdate()
    }
    audioWidget.callback = onAudioWidgetUpdate

    // Load saved audio file widget values if restoring from workflow
    const onGraphConfigured = node.onGraphConfigured
    node.onGraphConfigured = function () {
      // @ts-expect-error fixme ts strict error
      onGraphConfigured?.apply(this, arguments)
      if (audioWidget.value) {
        onAudioWidgetUpdate()
      }
    }

    const handleUpload = async (files: File[]) => {
      if (files?.length) {
        await this.uploadFile(audioWidget, audioUIWidget, files[0], true)
      }
      return files
    }

    const isAudioFile = (file: File) => file.type.startsWith('audio/')

    const { openFileSelection } = useNodeFileInput(node, {
      accept: 'audio/*',
      onSelect: handleUpload
    })

    // The widget to pop up the upload dialog
    const uploadWidget = node.addWidget(
      'button',
      inputName,
      '',
      openFileSelection,
      {
        serialize: false
      }
    )
    uploadWidget.label = t('g.choose_file_to_upload')

    useNodeDragAndDrop(node, {
      fileFilter: isAudioFile,
      onDrop: handleUpload
    })

    useNodePaste(node, {
      fileFilter: isAudioFile,
      onPaste: handleUpload
    })

    node.previewMediaType = 'audio'

    return { widget: uploadWidget }
  }

  createAudioRecord(node: LGraphNode, inputName: string): WidgetCreationResult {
    const audio = document.createElement('audio')
    audio.controls = true
    audio.classList.add('comfy-audio')
    audio.setAttribute('name', 'media')

    const audioUIWidget: DOMWidget<HTMLAudioElement, string> =
      node.addDOMWidget(inputName, 'audioUI', audio)

    let mediaRecorder: MediaRecorder | null = null
    let isRecording = false
    let audioChunks: Blob[] = []
    let currentStream: MediaStream | null = null
    let recordWidget: IBaseWidget | null = null

    let stopPromise: Promise<void> | null = null
    let stopResolve: (() => void) | null = null

    audioUIWidget.serializeValue = async () => {
      if (isRecording && mediaRecorder) {
        stopPromise = new Promise((resolve) => {
          stopResolve = resolve
        })

        mediaRecorder.stop()
        await stopPromise
      }

      const audioSrc = audioUIWidget.element.src

      if (!audioSrc) {
        useToastStore().addAlert(t('g.noAudioRecorded'))
        return ''
      }

      const blob = await fetch(audioSrc).then((r) => r.blob())
      return await useAudioService().convertBlobToFileAndSubmit(blob)
    }

    recordWidget = node.addWidget(
      'button',
      inputName,
      '',
      async () => {
        if (!isRecording) {
          try {
            currentStream = await navigator.mediaDevices.getUserMedia({
              audio: true
            })

            mediaRecorder = new ExtendableMediaRecorder(currentStream, {
              mimeType: 'audio/wav'
            }) as unknown as MediaRecorder

            audioChunks = []

            mediaRecorder.ondataavailable = (event) => {
              audioChunks.push(event.data)
            }

            mediaRecorder.onstop = async () => {
              const audioBlob = new Blob(audioChunks, { type: 'audio/wav' })

              useAudioService().stopAllTracks(currentStream)

              if (
                audioUIWidget.element.src &&
                audioUIWidget.element.src.startsWith('blob:')
              ) {
                URL.revokeObjectURL(audioUIWidget.element.src)
              }

              audioUIWidget.element.src = URL.createObjectURL(audioBlob)
              isRecording = false

              if (recordWidget) {
                recordWidget.label = t('g.startRecording')
              }

              if (stopResolve) {
                stopResolve()
                stopResolve = null
                stopPromise = null
              }
            }

            mediaRecorder.onerror = (event) => {
              console.error('MediaRecorder error:', event)
              useAudioService().stopAllTracks(currentStream)
              isRecording = false

              if (recordWidget) {
                recordWidget.label = t('g.startRecording')
              }

              if (stopResolve) {
                stopResolve()
                stopResolve = null
                stopPromise = null
              }
            }

            mediaRecorder.start()
            isRecording = true
            if (recordWidget) {
              recordWidget.label = t('g.stopRecording')
            }
          } catch (err) {
            console.error('Error accessing microphone:', err)
            useToastStore().addAlert(t('g.micPermissionDenied'))

            if (mediaRecorder) {
              try {
                mediaRecorder.stop()
              } catch {}
            }
            useAudioService().stopAllTracks(currentStream)
            currentStream = null
            isRecording = false
            if (recordWidget) {
              recordWidget.label = t('g.startRecording')
            }
          }
        } else if (mediaRecorder && isRecording) {
          mediaRecorder.stop()
        }
      },
      { serialize: false }
    )

    recordWidget.label = t('g.startRecording')

    const originalOnRemoved = node.onRemoved
    node.onRemoved = function () {
      if (isRecording && mediaRecorder) {
        mediaRecorder.stop()
      }
      useAudioService().stopAllTracks(currentStream)
      if (audioUIWidget.element.src?.startsWith('blob:')) {
        URL.revokeObjectURL(audioUIWidget.element.src)
      }
      originalOnRemoved?.call(this)
    }

    return { widget: recordWidget }
  }

  onNodeOutputsUpdated(nodeOutputs: Record<string, any>): void {
    for (const [nodeLocatorId, output] of Object.entries(nodeOutputs)) {
      if ('audio' in output) {
        const node = getNodeByLocatorId(app.graph, nodeLocatorId)
        if (!node) continue

        const audioUIWidget = node.widgets?.find(
          (w) => w.name === 'audioUI'
        ) as unknown as DOMWidget<HTMLAudioElement, string>
        const audio = output.audio[0]
        audioUIWidget.element.src = api.apiURL(
          this.getResourceURL(audio.subfolder, audio.filename, audio.type)
        )
        audioUIWidget.element.classList.remove('empty-audio-widget')
      }
    }
  }

  async onNodeCreated(node: LGraphNode): Promise<void> {
    if ((node.constructor as any).comfyClass === 'RecordAudio') {
      await useAudioService().registerWavEncoder()
    }
  }

  // Helper methods
  private splitFilePath(path: string): [string, string] {
    const folder_separator = path.lastIndexOf('/')
    if (folder_separator === -1) {
      return ['', path]
    }
    return [
      path.substring(0, folder_separator),
      path.substring(folder_separator + 1)
    ]
  }

  private getResourceURL(
    subfolder: string,
    filename: string,
    type = 'input'
  ): string {
    const params = [
      'filename=' + encodeURIComponent(filename),
      'type=' + type,
      'subfolder=' + subfolder,
      app.getRandParam().substring(1)
    ].join('&')
    return `/view?${params}`
  }

  private async uploadFile(
    audioWidget: IStringWidget,
    audioUIWidget: DOMWidget<HTMLAudioElement, string>,
    file: File,
    updateNode: boolean,
    pasted: boolean = false
  ): Promise<void> {
    try {
      const body = new FormData()
      body.append('image', file)
      if (pasted) body.append('subfolder', 'pasted')

      const resp = await api.fetchApi('/upload/image', {
        method: 'POST',
        body
      })

      if (resp.status === 200) {
        const data = await resp.json()
        let path = data.name
        if (data.subfolder) path = data.subfolder + '/' + path

        if (!audioWidget.options?.values?.includes(path)) {
          audioWidget.options = audioWidget.options || {}
          audioWidget.options.values = audioWidget.options.values || []
          audioWidget.options.values.push(path)
        }

        if (updateNode) {
          audioUIWidget.element.src = api.apiURL(
            this.getResourceURL(...this.splitFilePath(path))
          )
          audioWidget.value = path
        }
      } else {
        useToastStore().addAlert(resp.status + ' - ' + resp.statusText)
      }
    } catch (error) {
      useToastStore().addAlert(String(error))
    }
  }
}
