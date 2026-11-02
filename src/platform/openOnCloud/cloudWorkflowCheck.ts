import type { ComfyWorkflowJSON } from '@comfyorg/graph-model/workflowSchema'

/** A model Comfy Cloud lacks, as this computer has it. */
export interface CloudMissingModel {
  name: string
  folder: string
  bytes: number
}

/** What Comfy Cloud lacks to run a workflow. */
export interface CloudWorkflowGaps {
  nodePacks: string[]
  models: CloudMissingModel[]
}

/** Comfy Cloud's answer to whether it can run a workflow. */
export type CloudWorkflowVerdict =
  | { kind: 'canOpen' }
  | { kind: 'missing'; gaps: CloudWorkflowGaps }

/** Asks Comfy Cloud whether it can run a workflow. */
export type CloudWorkflowChecker = (
  workflow: ComfyWorkflowJSON
) => Promise<CloudWorkflowVerdict>

export type CloudWorkflowCheckState =
  | { phase: 'idle' }
  | { phase: 'checking'; run: number }
  | { phase: 'answered'; verdict: CloudWorkflowVerdict }

export type CloudWorkflowCheckEvent =
  | { type: 'started'; run: number }
  | { type: 'answered'; run: number; verdict: CloudWorkflowVerdict }

/** An answer counts only for the check still running. */
export function reduceCloudWorkflowCheck(
  state: CloudWorkflowCheckState,
  event: CloudWorkflowCheckEvent
): CloudWorkflowCheckState {
  switch (event.type) {
    case 'started':
      return { phase: 'checking', run: event.run }
    case 'answered':
      return state.phase === 'checking' && state.run === event.run
        ? { phase: 'answered', verdict: event.verdict }
        : state
  }
}

/** The workflow the prototype panel has the stand-in checker answer for. */
export type PrototypeScenario =
  | 'compatible'
  | 'nodePacksMissing'
  | 'modelsMissing'
  | 'nodePacksAndModelsMissing'
  | 'checking'

type ScenarioWithGaps = Exclude<PrototypeScenario, 'compatible' | 'checking'>

/** What the stand-in checker answers from. */
export interface PrototypeCheckInput {
  scenario: PrototypeScenario
  signedIn: boolean
  libraryHasModels: boolean
  uploadedModels: readonly string[]
}

export const PROTOTYPE_CHECK_MS = 1000

const PROTOTYPE_NODE_PACKS = ['rgthree-comfy', 'comfyui-impact-pack']

const FACE_DETECTOR: CloudMissingModel = {
  name: 'face_yolov8m.pt',
  folder: 'ultralytics/bbox',
  bytes: 52_000_000
}
const DETAIL_LORA: CloudMissingModel = {
  name: 'add-detail-xl.safetensors',
  folder: 'loras',
  bytes: 218_000_000
}
const JUGGERNAUT: CloudMissingModel = {
  name: 'juggernautXL_v9.safetensors',
  folder: 'checkpoints',
  bytes: 6_600_000_000
}

export const PROTOTYPE_GAPS: Record<ScenarioWithGaps, CloudWorkflowGaps> = {
  nodePacksMissing: { nodePacks: PROTOTYPE_NODE_PACKS, models: [] },
  modelsMissing: { nodePacks: [], models: [DETAIL_LORA, JUGGERNAUT] },
  nodePacksAndModelsMissing: {
    nodePacks: PROTOTYPE_NODE_PACKS,
    models: [FACE_DETECTOR]
  }
}

function isInLibrary(
  { signedIn, libraryHasModels, uploadedModels }: PrototypeCheckInput,
  model: CloudMissingModel
): boolean {
  return signedIn && (libraryHasModels || uploadedModels.includes(model.name))
}

/** The stand-in's answer: a signed-in person's library models count. */
export function prototypeVerdict(
  input: PrototypeCheckInput
): CloudWorkflowVerdict | null {
  switch (input.scenario) {
    case 'checking':
      return null
    case 'compatible':
      return { kind: 'canOpen' }
  }
  const { nodePacks, models } = PROTOTYPE_GAPS[input.scenario]
  const stillMissing = models.filter((model) => !isInLibrary(input, model))
  return nodePacks.length === 0 && stillMissing.length === 0
    ? { kind: 'canOpen' }
    : { kind: 'missing', gaps: { nodePacks, models: stillMissing } }
}

/**
 * Answers with what the prototype panel picks, after a pause; the checking
 * scenario never answers.
 */
export function prototypeCloudWorkflowChecker(
  pick: () => PrototypeCheckInput,
  pauseMs = PROTOTYPE_CHECK_MS
): CloudWorkflowChecker {
  return () => {
    const verdict = prototypeVerdict(pick())
    if (!verdict) return new Promise(() => {})
    return new Promise((resolve) => setTimeout(() => resolve(verdict), pauseMs))
  }
}
