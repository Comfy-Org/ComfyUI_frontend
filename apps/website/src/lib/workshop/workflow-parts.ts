import type {
  WorkflowWorkshopModelDetail,
  WorkshopModel
} from '@/config/models-catalogue'
import { workflowsUsingModel } from './model-workflows'

export interface WorkflowModelLink {
  readonly name: string
  readonly href?: string
}

export interface WorkflowFile {
  readonly name: string
  readonly directory?: string
  readonly href?: string
}

export interface WorkflowParts {
  readonly runsOn: readonly WorkflowModelLink[]
  readonly files: readonly WorkflowFile[]
}

type FileLookup = (
  name: string
) => Pick<WorkflowFile, 'directory' | 'href'> | undefined

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

function filesLoadedBy(
  workflow: WorkflowWorkshopModelDetail,
  lookup: FileLookup
): WorkflowFile[] {
  const nodes = Object.values(workflow.workflow.cloud?.workflow ?? {})
  const names = new Set(
    nodes.flatMap((node) =>
      Object.values(node.inputs).filter(
        (value): value is string =>
          typeof value === 'string' && MODEL_FILE.test(value)
      )
    )
  )
  return [...names].map((name) => ({ name, ...lookup(name) }))
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
