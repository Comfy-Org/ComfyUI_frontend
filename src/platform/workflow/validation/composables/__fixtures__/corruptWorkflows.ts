import type {
  ComfyWorkflowJSON,
  WorkflowJSON04
} from '@/platform/workflow/validation/schemas/workflowSchema'

type SerialisedNode = WorkflowJSON04['nodes'][number]
type SerialisedLink = WorkflowJSON04['links'][number]
type SerialisedInput = NonNullable<SerialisedNode['inputs']>[number]
type SerialisedOutput = NonNullable<SerialisedNode['outputs']>[number]

const createInput = (link: number | null): SerialisedInput => ({
  name: 'in',
  type: '*',
  link
})

const createOutput = (links: number[]): SerialisedOutput => ({
  name: 'out',
  type: '*',
  links
})

function createNode({
  id,
  inputs = [],
  outputs = []
}: {
  id: number
  inputs?: SerialisedInput[]
  outputs?: SerialisedOutput[]
}): SerialisedNode {
  return {
    id,
    type: 'TestNode',
    pos: [0, 0],
    size: [100, 100],
    flags: {},
    order: 0,
    mode: 0,
    properties: {},
    inputs,
    outputs
  }
}

function createWorkflow(
  id: string | undefined,
  nodes: SerialisedNode[],
  links: SerialisedLink[]
): ComfyWorkflowJSON {
  return {
    ...(id ? { id } : {}),
    last_node_id: 2,
    last_link_id: 1,
    nodes,
    links,
    groups: [],
    config: {},
    extra: {},
    version: 0.4
  }
}

export const intactWorkflow = (id: string) =>
  createWorkflow(
    id,
    [
      createNode({ id: 1, outputs: [createOutput([1])] }),
      createNode({ id: 2, inputs: [createInput(1)] })
    ],
    [[1, 1, 0, 2, 0, '*']]
  )

/** Link 1 targets the node after `originId`, which is not in the graph. */
export const corruptWorkflow = (id: string, originId = 1) =>
  createWorkflow(
    id,
    [createNode({ id: originId, outputs: [createOutput([1])] })],
    [[1, originId, 0, originId + 1, 0, '*']]
  )

/**
 * Id-less workflows whose corruption differs only in which nodes it names.
 * `patched`/`deleted` counts are identical across them, so a key built from
 * counts alone would report the first and discard the rest. Node ids come from
 * a counter because the reporters outlive a test: fixed ids would make a CI
 * retry of a transient failure fail permanently.
 */
let nodeIdSeed = 1000
export const unidentifiedCorruptWorkflow = () => {
  const originId = (nodeIdSeed += 2)
  return createWorkflow(
    undefined,
    [createNode({ id: originId, outputs: [createOutput([1])] })],
    [[1, originId, 0, originId + 1, 0, '*']]
  )
}

let workflowCount = 0
export const uniqueId = () =>
  `b4e984f1-b421-4d24-b8b4-ff895793a${String(workflowCount++).padStart(3, '0')}`
