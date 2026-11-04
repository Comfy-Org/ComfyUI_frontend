import type { ComfyWorkflowJSON } from '@comfyorg/graph-model/workflowSchema'
import type { ComfyNodeDef as ComfyNodeDefV1 } from '@comfyorg/object-info-parser'
import { vi } from 'vitest'
import { ref } from 'vue'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { api } from '@/scripts/api'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { graphToPrompt } from '@/utils/executionUtil'

export const APP_ROOT_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d'

export interface AppHooks {
  afterQueued?: () => void
}

class LoadImage extends LGraphNode {
  constructor(title?: string) {
    super(title ?? 'Load Image')
    this.comfyClass = 'LoadImage'
    this.serialize_widgets = true
    this.addWidget('combo', 'image', 'example.png', () => undefined, {
      values: ['example.png']
    })
    this.addOutput('IMAGE', 'IMAGE')
  }
}

class TextEncode extends LGraphNode {
  constructor(title?: string) {
    super(title ?? 'Prompt')
    this.comfyClass = 'CLIPTextEncode'
    this.serialize_widgets = true
    const text = this.addWidget(
      'text',
      'text',
      'saved prompt',
      () => undefined,
      {}
    )
    text.serializeValue = async () => {
      await Promise.resolve()
      return text.value
    }
  }
}

class PreviewImage extends LGraphNode {
  constructor(title?: string) {
    super(title ?? 'Preview')
    this.comfyClass = 'PreviewImage'
    this.addInput('images', 'IMAGE')
  }
}

function samplerType(hooks: AppHooks) {
  return class Sampler extends LGraphNode {
    constructor(title?: string) {
      super(title ?? 'Sampler')
      this.comfyClass = 'KSampler'
      this.serialize_widgets = true
      const seed = this.addWidget('number', 'seed', 0, () => undefined, {})
      seed.beforeQueued = () => {
        seed.value = Number(seed.value) + 1
      }
      seed.afterQueued = () => hooks.afterQueued?.()
    }
  }
}

/** Registers LoadImage(1), CLIPTextEncode(2), KSampler(3) and PreviewImage(4) stand-ins. */
export function registerAppNodeTypes(hooks: AppHooks = {}) {
  LiteGraph.registerNodeType('LoadImage', LoadImage)
  LiteGraph.registerNodeType('CLIPTextEncode', TextEncode)
  LiteGraph.registerNodeType('KSampler', samplerType(hooks))
  LiteGraph.registerNodeType('PreviewImage', PreviewImage)
}

function nodeDef(
  name: string,
  required: ComfyNodeDefV1['input'],
  outputNode = false
): ComfyNodeDefV1 {
  return {
    name,
    display_name: name,
    category: 'test',
    python_module: 'nodes',
    description: '',
    output_node: outputNode,
    input: required,
    output: [],
    output_is_list: [],
    output_name: []
  }
}

export function registerAppNodeDefs() {
  const store = useNodeDefStore()
  store.addNodeDef(
    nodeDef('LoadImage', {
      required: { image: [['example.png'], { image_upload: true }] }
    })
  )
  store.addNodeDef(
    nodeDef('CLIPTextEncode', {
      required: { text: ['STRING', { multiline: true }] }
    })
  )
  store.addNodeDef(
    nodeDef('KSampler', {
      required: { seed: ['INT', { default: 0, min: 0, max: 1000 }] }
    })
  )
  store.addNodeDef(
    nodeDef('PreviewImage', { required: { images: ['IMAGE'] } }, true)
  )
}

/** A saved app built from the registered stand-ins, plus any extra node types. */
export async function savedAppJson(
  extraTypes: readonly string[] = []
): Promise<ComfyWorkflowJSON> {
  const scratch = new LGraph()
  const nodes = [
    'LoadImage',
    'CLIPTextEncode',
    'KSampler',
    'PreviewImage',
    ...extraTypes
  ].map((type) => LiteGraph.createNode(type) ?? new LGraphNode(type, type))
  for (const node of nodes) scratch.add(node)
  const [loader, , , preview] = nodes
  loader.connect(0, preview, 0)
  return { ...(await graphToPrompt(scratch)).workflow, id: APP_ROOT_ID }
}

export function serveUserData(files: Record<string, ComfyWorkflowJSON>) {
  vi.spyOn(api, 'getUserData').mockImplementation(async (path) =>
    Response.json(files[path])
  )
}

/** Makes `json` the saved app at a fresh path in the workflow store. */
export function storeSavedApp(json: ComfyWorkflowJSON): ComfyWorkflow {
  const path = `workflows/${crypto.randomUUID()}.app.json`
  const lookup = ref<Record<string, ComfyWorkflow>>({
    [path]: new ComfyWorkflow({ path, modified: 1000, size: 1 })
  })
  const workflow = lookup.value[path]
  serveUserData({ [path]: json })
  vi.mocked(useWorkflowStore().getWorkflowByPath).mockImplementation(
    (requested) => (requested === path ? workflow : null)
  )
  return workflow
}
