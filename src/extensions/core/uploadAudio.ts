/**
 * Audio Widget Extension - Factory Pattern Implementation
 * Dynamically selects between Vue and LiteGraph implementations
 */
import { LiteGraph } from '@/lib/litegraph/src/litegraph'

import { app } from '../../scripts/app'
import type { AudioWidgetFactory } from './factories/AudioWidgetFactory'
import { LiteGraphAudioWidgetFactory } from './factories/LiteGraphAudioWidgetFactory'
import { VueAudioWidgetFactory } from './factories/VueAudioWidgetFactory'

// Create the appropriate factory based on the current mode
const audioFactory: AudioWidgetFactory = LiteGraph.vueNodesMode
  ? new VueAudioWidgetFactory()
  : new LiteGraphAudioWidgetFactory()

// AudioWidget MUST be registered first, as AUDIOUPLOAD depends on AUDIO_UI to be present
app.registerExtension({
  name: 'Comfy.AudioWidget',
  async beforeRegisterNodeDef(nodeType, nodeData) {
    audioFactory.beforeRegisterNodeDef?.(nodeType, nodeData)
  },
  getCustomWidgets() {
    return {
      AUDIO_UI: audioFactory.createAudioUI.bind(audioFactory)
    }
  },
  onNodeOutputsUpdated(nodeOutputs: Record<string, any>) {
    audioFactory.onNodeOutputsUpdated?.(nodeOutputs)
  }
})

app.registerExtension({
  name: 'Comfy.UploadAudio',
  async beforeRegisterNodeDef(nodeType, nodeData) {
    audioFactory.beforeRegisterNodeDef?.(nodeType, nodeData)
  },
  getCustomWidgets() {
    return {
      AUDIOUPLOAD: audioFactory.createAudioUpload.bind(audioFactory)
    }
  }
})

app.registerExtension({
  name: 'Comfy.RecordAudio',
  getCustomWidgets() {
    return {
      AUDIO_RECORD: audioFactory.createAudioRecord.bind(audioFactory)
    }
  },
  async nodeCreated(node) {
    await audioFactory.onNodeCreated?.(node)
  }
})
