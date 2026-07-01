import type { CustomNodeOutcome } from '@e2e/fixtures/customNode/runResult'

export interface ObjectInfoNode {
  input?: { required?: Record<string, unknown> }
}
export type ObjectInfo = Record<string, ObjectInfoNode>

export interface ApiPromptNode {
  id: string
  classType: string
  inputs: Record<string, unknown>
}

export function expectedNodesPresent(
  objectInfo: ObjectInfo,
  expectedNodes: string[]
): { present: string[]; missing: string[] } {
  const present: string[] = []
  const missing: string[] = []
  for (const name of expectedNodes) {
    if (name in objectInfo) present.push(name)
    else missing.push(name)
  }
  return { present, missing }
}

export interface PreValidationFailure {
  outcome: Extract<CustomNodeOutcome, 'MISSING_NODE' | 'VALIDATION_FAIL'>
  message: string
}

// Turns an opaque backend 400 into a precise infra error before submit (BE-401):
// every required input declared in object_info must be present in the fixture node.
export function preValidate(
  objectInfo: ObjectInfo,
  nodes: ApiPromptNode[]
): PreValidationFailure | null {
  for (const node of nodes) {
    const def = objectInfo[node.classType]
    if (!def)
      return {
        outcome: 'MISSING_NODE',
        message: `node ${node.id} ${node.classType} missing from object_info`
      }
    for (const name of Object.keys(def.input?.required ?? {})) {
      if (!(name in node.inputs))
        return {
          outcome: 'VALIDATION_FAIL',
          message: `node ${node.id} ${node.classType} missing required input "${name}"`
        }
    }
  }
  return null
}
