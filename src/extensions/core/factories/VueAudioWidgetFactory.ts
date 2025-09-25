/**
 * Vue Audio Widget Factory
 * Creates minimal placeholder widgets that Vue components can recognize and render
 */
import { t } from '@/i18n'
import { type LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useAudioService } from '@/services/audioService'
import { vueWidgetSerializationStore } from '@/stores/vueWidgetSerializationStore'
import { getNodeByLocatorId } from '@/utils/graphTraversalUtil'

import { api } from '../../../scripts/api'
import { app } from '../../../scripts/app'
import type {
  AudioWidgetFactory,
  WidgetCreationResult
} from './AudioWidgetFactory'

export class VueAudioWidgetFactory implements AudioWidgetFactory {
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
    // Create simple placeholder widget for Vue
    const audioUIWidget = node.addWidget('custom', inputName, '', () => {}, {
      serialize: false
    }) as IBaseWidget

    // Set the type that Vue components expect
    audioUIWidget.type = 'AUDIO_UI'

    // Add serialization support for RecordAudio nodes
    if ((node.constructor as any).comfyClass === 'RecordAudio') {
      audioUIWidget.serializeValue = async () => {
        const serializationFn = vueWidgetSerializationStore.get(
          `${node.id}-audioUI`
        )
        if (serializationFn) {
          const result = await serializationFn()
          audioUIWidget.value = result
          return result
        }
        return audioUIWidget.value || ''
      }
    }

    return { widget: audioUIWidget }
  }

  createAudioUpload(node: LGraphNode, inputName: string): WidgetCreationResult {
    // Create simple placeholder widget for Vue
    const uploadWidget = node.addWidget('button', inputName, '', () => {}, {
      serialize: false
    }) as IBaseWidget

    // Set the type that Vue components expect
    uploadWidget.type = 'AUDIOUPLOAD'
    uploadWidget.label = t('g.choose_file_to_upload')

    return { widget: uploadWidget }
  }

  createAudioRecord(node: LGraphNode, inputName: string): WidgetCreationResult {
    // Create simple placeholder widget for Vue
    const recordWidget = node.addWidget('custom', inputName, '', () => {}, {
      serialize: true
    }) as IBaseWidget

    // Set the type that Vue components expect
    recordWidget.type = 'AUDIO_RECORD'

    // Set up serialization bridge for RecordAudio
    recordWidget.serializeValue = async () => {
      const serializationFn = vueWidgetSerializationStore.get(
        `${node.id}-audioUI`
      )
      if (serializationFn) {
        const result = await serializationFn()
        recordWidget.value = result
        return result
      }
      return recordWidget.value || ''
    }

    return { widget: recordWidget }
  }

  onNodeOutputsUpdated(nodeOutputs: Record<string, any>): void {
    // Helper function to get resource URL
    function getResourceURL(
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

    for (const [nodeLocatorId, output] of Object.entries(nodeOutputs)) {
      if ('audio' in output) {
        const node = getNodeByLocatorId(app.graph, nodeLocatorId)
        if (!node) continue

        const audioUIWidget = node.widgets?.find(
          (w) => w.name === 'audioUI'
        ) as IBaseWidget
        if (audioUIWidget) {
          const audio = output.audio[0]
          audioUIWidget.value = api.apiURL(
            getResourceURL(audio.subfolder, audio.filename, audio.type)
          )
        }
      }
    }
  }

  async onNodeCreated(node: LGraphNode): Promise<void> {
    if ((node.constructor as any).comfyClass === 'RecordAudio') {
      await useAudioService().registerWavEncoder()
    }
  }
}
