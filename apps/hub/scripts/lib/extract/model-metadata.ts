import type { WorkflowJson, WorkflowModelRef } from '../types'

export type { WorkflowModelRef }

const NODE_TYPE_TO_KIND: Record<string, WorkflowModelRef['kind']> = {
  CheckpointLoaderSimple: 'checkpoint',
  ImageOnlyCheckpointLoader: 'checkpoint',
  UNETLoader: 'unet',
  VAELoader: 'vae',
  CLIPLoader: 'clip',
  DualCLIPLoader: 'clip',
  QuadrupleCLIPLoader: 'clip',
  CLIPVisionLoader: 'clip',
  LoraLoader: 'lora',
  LoraLoaderModelOnly: 'lora',
  ControlNetLoader: 'controlnet',
  LatentUpscaleModelLoader: 'upscaler',
  ImageUpscaleWithModel: 'upscaler',
  StyleModelLoader: 'other',
  ModelPatchLoader: 'other',
  AudioEncoderLoader: 'other'
}

const MODEL_EXTENSIONS = [
  '.safetensors',
  '.ckpt',
  '.pt',
  '.pth',
  '.bin',
  '.onnx',
  '.gguf'
]

function isModelFilename(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const lower = value.toLowerCase()
  return MODEL_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

function extractModelFilenames(widgetsValues: unknown): string[] {
  if (Array.isArray(widgetsValues)) {
    return widgetsValues.filter(isModelFilename)
  }
  if (typeof widgetsValues === 'object' && widgetsValues !== null) {
    return Object.values(widgetsValues).filter(isModelFilename)
  }
  return []
}

export function extractWorkflowModels(
  workflow: WorkflowJson
): WorkflowModelRef[] {
  const nodes = workflow.nodes ?? []
  const seen = new Set<string>()
  const results: WorkflowModelRef[] = []

  for (const node of nodes) {
    const kind = NODE_TYPE_TO_KIND[node.type]
    if (!kind) continue

    const filenames = extractModelFilenames(node.widgets_values)
    for (const filename of filenames) {
      const key = `${kind}:${filename}`
      if (seen.has(key)) continue
      seen.add(key)
      results.push({ kind, filename, nodeType: node.type })
    }
  }

  results.sort(
    (a, b) =>
      a.kind.localeCompare(b.kind) || a.filename.localeCompare(b.filename)
  )
  return results
}
