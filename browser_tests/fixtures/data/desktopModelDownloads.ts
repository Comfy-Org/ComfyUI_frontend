import type { ComfyDownloadProgress } from '@comfyorg/comfyui-desktop-bridge-types'

/** A template whose workflow needs two missing models served from one URL. */
export const twoMissingModelsTemplate = {
  name: 'two-missing-models',
  workflow: 'missing/missing_models_distinct',
  modelUrl: 'http://localhost:8188/api/devtools/fake_model.safetensors',
  modelA: 'fake_model_a.safetensors',
  modelB: 'fake_model_b.safetensors'
} as const

/** A quarter-done host download of one of its models, as started on the canvas. */
export function canvasDownload(
  filename: string,
  overrides: Partial<ComfyDownloadProgress> = {}
): ComfyDownloadProgress {
  return {
    id: `canvas-${filename}`,
    url: twoMissingModelsTemplate.modelUrl,
    filename,
    directory: 'checkpoints',
    status: 'downloading',
    progress: 0.25,
    receivedBytes: 256 * 1024 * 1024,
    totalBytes: 1024 * 1024 * 1024,
    ...overrides
  }
}
