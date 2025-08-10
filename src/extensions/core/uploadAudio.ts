import { MediaRecorder as ExtendableMediaRecorder } from 'extendable-media-recorder'

import { useChainCallback } from '@/composables/functional/useChainCallback'
import { useNodeDragAndDrop } from '@/composables/node/useNodeDragAndDrop'
import { useNodeFileInput } from '@/composables/node/useNodeFileInput'
import { useNodePaste } from '@/composables/node/useNodePaste'
import { t } from '@/i18n'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type {
  IBaseWidget,
  IStringWidget
} from '@/lib/litegraph/src/types/widgets'
import type { ResultItemType } from '@/schemas/apiSchema'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import type { DOMWidget } from '@/scripts/domWidget'
import { useAudioService } from '@/services/audioService'
import { useToastStore } from '@/stores/toastStore'
import { NodeLocatorId } from '@/types'
import { getNodeByLocatorId } from '@/utils/graphTraversalUtil'

import { api } from '../../scripts/api'
import { app } from '../../scripts/app'

function splitFilePath(path: string): [string, string] {
  const folder_separator = path.lastIndexOf('/')
  if (folder_separator === -1) {
    return ['', path]
  }
  return [
    path.substring(0, folder_separator),
    path.substring(folder_separator + 1)
  ]
}

function getResourceURL(
  subfolder: string,
  filename: string,
  type: ResultItemType = 'input'
): string {
  const params = [
    'filename=' + encodeURIComponent(filename),
    'type=' + type,
    'subfolder=' + subfolder,
    app.getRandParam().substring(1)
  ].join('&')

  return `/view?${params}`
}

async function uploadFile(
  audioWidget: IStringWidget,
  audioUIWidget: DOMWidget<HTMLAudioElement, string>,
  file: File,
  updateNode: boolean,
  pasted: boolean = false
) {
  try {
    // Wrap file in formdata so it includes filename
    const body = new FormData()
    body.append('image', file)
    if (pasted) body.append('subfolder', 'pasted')
    const resp = await api.fetchApi('/upload/image', {
      method: 'POST',
      body
    })

    if (resp.status === 200) {
      const data = await resp.json()
      // Add the file to the dropdown list and update the widget value
      let path = data.name
      if (data.subfolder) path = data.subfolder + '/' + path

      // @ts-expect-error fixme ts strict error
      if (!audioWidget.options.values.includes(path)) {
        // @ts-expect-error fixme ts strict error
        audioWidget.options.values.push(path)
      }

      if (updateNode) {
        audioUIWidget.element.src = api.apiURL(
          getResourceURL(...splitFilePath(path))
        )
        audioWidget.value = path
      }
    } else {
      useToastStore().addAlert(resp.status + ' - ' + resp.statusText)
    }
  } catch (error) {
    // @ts-expect-error fixme ts strict error
    useToastStore().addAlert(error)
  }
}

// AudioWidget MUST be registered first, as AUDIOUPLOAD depends on AUDIO_UI to be
// present.
app.registerExtension({
  name: 'Comfy.AudioWidget',
  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (
      [
        'LoadAudio',
        'SaveAudio',
        'PreviewAudio',
        'SaveAudioMP3',
        'SaveAudioOpus'
      ].includes(
        // @ts-expect-error fixme ts strict error
        nodeType.prototype.comfyClass
      )
    ) {
      // @ts-expect-error fixme ts strict error
      nodeData.input.required.audioUI = ['AUDIO_UI', {}]
    }
  },
  getCustomWidgets() {
    return {
      AUDIO_UI(node: LGraphNode, inputName: string) {
        const audio = document.createElement('audio')
        audio.controls = true
        audio.classList.add('comfy-audio')
        audio.setAttribute('name', 'media')

        const audioUIWidget: DOMWidget<HTMLAudioElement, string> =
          node.addDOMWidget(inputName, /* name=*/ 'audioUI', audio)
        audioUIWidget.serialize = false

        const { nodeData } = node.constructor
        if (nodeData == null) throw new TypeError('nodeData is null')

        const isOutputNode = nodeData.output_node
        if (isOutputNode) {
          // Hide the audio widget when there is no audio initially.
          audioUIWidget.element.classList.add('empty-audio-widget')
          // Populate the audio widget UI on node execution.
          const onExecuted = node.onExecuted
          node.onExecuted = function (message: any) {
            // @ts-expect-error fixme ts strict error
            onExecuted?.apply(this, arguments)
            const audios = message.audio
            if (!audios) return
            const audio = audios[0]
            audioUIWidget.element.src = api.apiURL(
              getResourceURL(audio.subfolder, audio.filename, audio.type)
            )
            audioUIWidget.element.classList.remove('empty-audio-widget')
          }
        }

        audioUIWidget.onRemove = useChainCallback(
          audioUIWidget.onRemove,
          () => {
            if (!audioUIWidget.element) return
            audioUIWidget.element.pause()
            audioUIWidget.element.src = ''
            audioUIWidget.element.remove()
          }
        )

        return { widget: audioUIWidget }
      }
    }
  },
  onNodeOutputsUpdated(nodeOutputs: Record<NodeLocatorId, any>) {
    for (const [nodeLocatorId, output] of Object.entries(nodeOutputs)) {
      if ('audio' in output) {
        const node = getNodeByLocatorId(app.graph, nodeLocatorId)
        if (!node) continue

        // @ts-expect-error fixme ts strict error
        const audioUIWidget = node.widgets.find(
          (w) => w.name === 'audioUI'
        ) as unknown as DOMWidget<HTMLAudioElement, string>
        const audio = output.audio[0]
        audioUIWidget.element.src = api.apiURL(
          getResourceURL(audio.subfolder, audio.filename, audio.type)
        )
        audioUIWidget.element.classList.remove('empty-audio-widget')
      }
    }
  }
})

app.registerExtension({
  name: 'Comfy.UploadAudio',
  async beforeRegisterNodeDef(_nodeType, nodeData: ComfyNodeDef) {
    if (nodeData?.input?.required?.audio?.[1]?.audio_upload === true) {
      nodeData.input.required.upload = ['AUDIOUPLOAD', {}]
    }
  },
  getCustomWidgets() {
    return {
      AUDIOUPLOAD(node, inputName: string) {
        // The widget that allows user to select file.
        // @ts-expect-error fixme ts strict error
        const audioWidget = node.widgets.find(
          (w) => w.name === 'audio'
        ) as IStringWidget
        // @ts-expect-error fixme ts strict error
        const audioUIWidget = node.widgets.find(
          (w) => w.name === 'audioUI'
        ) as unknown as DOMWidget<HTMLAudioElement, string>

        const onAudioWidgetUpdate = () => {
          audioUIWidget.element.src = api.apiURL(
            getResourceURL(...splitFilePath(audioWidget.value as string))
          )
        }
        // Initially load default audio file to audioUIWidget.
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
            uploadFile(audioWidget, audioUIWidget, files[0], true)
          }
          return files
        }

        const isAudioFile = (file: File) => file.type.startsWith('audio/')

        const { openFileSelection } = useNodeFileInput(node, {
          accept: 'audio/*',
          onSelect: handleUpload
        })

        // The widget to pop up the upload dialog.
        const uploadWidget = node.addWidget(
          'button',
          inputName,
          '',
          openFileSelection,
          { serialize: false }
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
    }
  }
})

app.registerExtension({
  name: 'Comfy.RecordAudio',

  getCustomWidgets() {
    return {
      AUDIO_RECORD(node, inputName: string) {
        const audio = document.createElement('audio')
        audio.controls = true
        audio.classList.add('comfy-audio')
        audio.setAttribute('name', 'media')

        const audioUIWidget: DOMWidget<HTMLAudioElement, string> =
          node.addDOMWidget(inputName, /* name=*/ 'audioUI', audio)

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
    }
  },

  async nodeCreated(node) {
    if (node.constructor.comfyClass !== 'RecordAudio') return

    await useAudioService().registerWavEncoder()
  }
})
