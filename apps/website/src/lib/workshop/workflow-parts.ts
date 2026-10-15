import type {
  WorkflowWorkshopModelDetail,
  WorkshopModel
} from '@/config/models-catalogue'
import { workflowsUsingModel } from './model-workflows'

interface WorkflowModelLink {
  readonly name: string
  readonly href?: string
}

interface WorkflowFile {
  readonly name: string
  readonly directory?: string
  /** Where it goes inside a ComfyUI install, when the type says for certain. */
  readonly folder?: string
  readonly href?: string
  readonly downloadUrl?: string
}

export interface WorkflowParts {
  readonly runsOn: readonly WorkflowModelLink[]
  readonly files: readonly WorkflowFile[]
}

type FileLookup = (
  name: string
) => Pick<WorkflowFile, 'directory' | 'href' | 'downloadUrl'> | undefined

const COMFYUI_MODEL_FOLDERS = new Set([
  'checkpoints',
  'diffusion_models',
  'loras',
  'vae',
  'text_encoders',
  'clip_vision',
  'controlnet',
  'upscale_models',
  'latent_upscale_models',
  'audio_encoders',
  'model_patches',
  'style_models'
])

/** The folder ComfyUI loads this type of model file from. */
export function comfyuiFolder(directory: string | undefined) {
  return directory && COMFYUI_MODEL_FOLDERS.has(directory)
    ? `models/${directory}/`
    : undefined
}

const MODEL_FILE = /\.(?:safetensors|ckpt|pth|pt|bin|gguf|onnx)$/i

// The hosted page a named model points at: the one model the name picks out
// that does this workflow's task.
function hostedPageFor(
  name: string,
  workflow: WorkflowWorkshopModelDetail,
  hosted: readonly WorkshopModel[]
): string | undefined {
  const named = { ...workflow, models: [name] }
  const useCase = workflow.useCases?.[0]
  const pages = hosted.filter(
    (model) =>
      model.workflowId === undefined &&
      model.href !== undefined &&
      (!useCase || model.useCases?.includes(useCase)) &&
      workflowsUsingModel(model, [named]).length > 0
  )
  return pages.length === 1 ? pages[0].href : undefined
}

/** The model file names a workflow's nodes load, each once. */
export function modelFileNames(
  workflow: Pick<WorkflowWorkshopModelDetail, 'workflow'>
): string[] {
  const nodes = Object.values(workflow.workflow.cloud?.workflow ?? {})
  return [
    ...new Set(
      nodes.flatMap((node) =>
        Object.values(node.inputs).filter(
          (value): value is string =>
            typeof value === 'string' && MODEL_FILE.test(value)
        )
      )
    )
  ]
}

function filesLoadedBy(
  workflow: WorkflowWorkshopModelDetail,
  lookup: FileLookup
): WorkflowFile[] {
  return modelFileNames(workflow).map((name) => {
    const found = lookup(name)
    const folder = comfyuiFolder(found?.directory)
    return { name, ...found, ...(folder ? { folder } : {}) }
  })
}

export function workflowParts(
  workflow: WorkflowWorkshopModelDetail,
  hosted: readonly WorkshopModel[],
  lookup: FileLookup
): WorkflowParts {
  return {
    runsOn: (workflow.workflow.template?.models ?? []).map((name) => {
      const href = hostedPageFor(name, workflow, hosted)
      return href ? { name, href } : { name }
    }),
    files: filesLoadedBy(workflow, lookup)
  }
}
