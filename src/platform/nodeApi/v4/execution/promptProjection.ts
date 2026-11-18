import { isPlainObject } from 'es-toolkit'

import { ExecutableNodeDTO } from '@/lib/litegraph/src/litegraph'
import type { ExecutableLGraphNode } from '@/lib/litegraph/src/litegraph'

import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import { reportIfRejected } from '@/platform/nodeApi/shared/listeners'
import type { NodeHookSource } from '@/platform/nodeApi/v4/defs/dispatchContext'

/** The inputs the `onPromptSerialize` hooks of a node's type leave out of its prompt entry. */
export function omittedInputs(
  node: ExecutableLGraphNode,
  nodeHooks: NodeHookSource
): readonly string[] {
  if (
    nodeHooks.demand('onPromptSerialize') === 0 ||
    !(node instanceof ExecutableNodeDTO)
  ) {
    return []
  }
  const answers = nodeHooks.deliverTo(
    node.node,
    'onPromptSerialize',
    (callback, handle) => {
      const given = callback(handle)
      reportIfRejected('onPromptSerialize', given)
      return checkedOmissions(given)
    }
  )
  return answers.flatMap((names) => names ?? [])
}

function checkedOmissions(projection: unknown): readonly string[] {
  if (projection === undefined) return []
  if (
    isPlainObject(projection) &&
    Object.keys(projection).length === 1 &&
    Array.isArray(projection.omitInputs) &&
    projection.omitInputs.every((name: unknown) => typeof name === 'string')
  ) {
    return [...projection.omitInputs]
  }
  throw invalidArgument(
    'onPromptSerialize',
    'a projection of { omitInputs } input names',
    projection
  )
}
