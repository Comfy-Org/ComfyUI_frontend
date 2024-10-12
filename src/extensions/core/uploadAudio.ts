// @ts-strict-ignore
import { app } from '../../scripts/app'
import { api } from '../../scripts/api'
import type { IWidget } from '@comfyorg/litegraph'
import type { DOMWidget } from '@/scripts/domWidget'
import { ComfyNodeDef } from '@/types/apiTypes'
import { useToastStore } from '@/stores/toastStore'

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
  audioWidget: IWidget,
  audioUIWidget: DOMWidget<HTMLAudioElement>,
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

      if (!audioWidget.options.values.includes(path)) {
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
    useToastStore().addAlert(error)
  }
}

// AudioWidget MUST be registered first, as AUDIOUPLOAD depends on AUDIO_UI to be
// present.
app.registerExtension({
  name: 'Comfy.AudioWidget',
  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (
      ['LoadAudio', 'SaveAudio', 'PreviewAudio'].includes(nodeType.comfyClass)
    ) {
      nodeData.input.required.audioUI = ['AUDIO_UI']
    }
  },
  getCustomWidgets() {
    return {
      AUDIO_UI(node, inputName: string) {
        const audio = document.createElement('audio')
        audio.controls = true
        audio.classList.add('comfy-audio')
        audio.setAttribute('name', 'media')

        const audioUIWidget: DOMWidget<HTMLAudioElement> = node.addDOMWidget(
          inputName,
          /* name=*/ 'audioUI',
          audio,
          { serialize: false }
        )

        const isOutputNode = node.constructor.nodeData.output_node
        if (isOutputNode) {
          // Hide the audio widget when there is no audio initially.
          audioUIWidget.element.classList.add('empty-audio-widget')
          // Populate the audio widget UI on node execution.
          const onExecuted = node.onExecuted
          node.onExecuted = function (message) {
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
        const audioUIWidget = node.widgets.find(
          (w) => w.name === 'audioUI'
        ) as unknown as DOMWidget<HTMLAudioElement>
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
  async beforeRegisterNodeDef(nodeType, nodeData: ComfyNodeDef) {
    if (nodeData?.input?.required?.audio?.[1]?.audio_upload === true) {
      nodeData.input.required.upload = ['AUDIOUPLOAD']
    }
  },
  getCustomWidgets() {
    return {
      AUDIOUPLOAD(node, inputName: string) {
        // The widget that allows user to select file.
        const audioWidget: IWidget = node.widgets.find(
          (w: IWidget) => w.name === 'audio'
        )
        const audioUIWidget: DOMWidget<HTMLAudioElement> = node.widgets.find(
          (w: IWidget) => w.name === 'audioUI'
        )

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
          onGraphConfigured?.apply(this, arguments)
          if (audioWidget.value) {
            onAudioWidgetUpdate()
          }
        }

        const fileInput = document.createElement('input')
        fileInput.type = 'file'
        fileInput.accept = 'audio/*'
        fileInput.style.display = 'none'
        fileInput.onchange = () => {
          if (fileInput.files.length) {
            uploadFile(audioWidget, audioUIWidget, fileInput.files[0], true)
          }
        }
        // The widget to pop up the upload dialog.
        const uploadWidget = node.addWidget(
          'button',
          inputName,
          /* value=*/ '',
          () => {
            fileInput.click()
          },
          { serialize: false }
        )
        uploadWidget.label = 'choose file to upload'

        return { widget: uploadWidget }
      }
    }
  }
})
