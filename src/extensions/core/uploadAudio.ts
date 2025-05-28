import type { LGraphNode } from '@comfyorg/litegraph'
import type { IStringWidget } from '@comfyorg/litegraph/dist/types/widgets'

import { useNodeDragAndDrop } from '@/composables/node/useNodeDragAndDrop'
import { useNodeFileInput } from '@/composables/node/useNodeFileInput'
import { useNodePaste } from '@/composables/node/useNodePaste'
import { t } from '@/i18n'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import type { DOMWidget } from '@/scripts/domWidget'
import { useToastStore } from '@/stores/toastStore'

import { api } from '../../scripts/api'
import { app } from '../../scripts/app'

type FolderType = 'input' | 'output' | 'temp'

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
  type: FolderType = 'input'
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
        return { widget: audioUIWidget }
      }
    }
  },
  onNodeOutputsUpdated(nodeOutputs: Record<number, any>) {
    for (const [nodeId, output] of Object.entries(nodeOutputs)) {
      const node = app.graph.getNodeById(nodeId)
      if ('audio' in output) {
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
