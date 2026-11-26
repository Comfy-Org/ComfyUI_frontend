import type { LGraph } from '@/lib/litegraph/src/LGraph'
import { ExecutableNodeDTO } from '@/lib/litegraph/src/litegraph'
import type { ExecutableLGraphNode } from '@/lib/litegraph/src/litegraph'

import { savedCopier } from '@/platform/nodeApi/shared/savedCopy'
import type { SavedCopier } from '@/platform/nodeApi/shared/savedCopy'
import type { DefinedResolvers } from '@/platform/nodeApi/v4/defs/defRegistry'
import type { NodeHookSource } from '@/platform/nodeApi/v4/defs/dispatchContext'
import type { ResolvedSupply } from '@/platform/nodeApi/v4/types'
import type { FrontendExecution } from '@/utils/executionUtil'
import { createNodeViews } from './nodeView'
import { deliverPreview } from './previews'
import { omittedInputs } from './promptProjection'
import { createResolutions } from './resolution'
import type { Resolutions } from './resolution'
import { ResolvedNodeDTO } from './resolvedNodeDto'
import { resolvedSuppliesIn } from './resolvedSupplies'
import { SuppliedNodeDTO } from './suppliedNodeDto'
import { createSupplies } from './supply'
import type { GraphSupplies } from './supply'

interface FrontendExecutionParts {
  readonly prompt: FrontendExecution
  resolvedSupplies(graph: LGraph): readonly ResolvedSupply[]
  deliverPreview(rootGraph: LGraph, executionId: string, blob: Blob): void
}

interface Build {
  readonly resolutions: Resolutions
  readonly suppliesOf: (graph: LGraph) => GraphSupplies
}

export function createFrontendExecution(
  resolvers: DefinedResolvers,
  nodeHooks: NodeHookSource
): FrontendExecutionParts {
  const copyOfSaved = savedCopier()
  const newBuild = () => buildOf(copyOfSaved, nodeHooks)

  return {
    prompt: {
      adoptNodes(nodes) {
        const supplying = nodeHooks.demand('setSupply') > 0
        if (!resolvers.any() && !supplying) return
        const build = newBuild()
        const suppliesOf = supplying ? build.suppliesOf : undefined
        for (const [id, node] of nodes) {
          nodes.set(
            id,
            executableFor(node, resolvers, build.resolutions, suppliesOf)
          )
        }
      },
      omittedInputs: (node) => omittedInputs(node, nodeHooks)
    },
    deliverPreview: (rootGraph, executionId, blob) =>
      deliverPreview(rootGraph, executionId, blob, nodeHooks),
    resolvedSupplies(graph) {
      const { resolutions, suppliesOf } = newBuild()
      return resolvedSuppliesIn(
        graph,
        suppliesOf(graph),
        resolvers.resolverFor,
        resolutions
      )
    }
  }
}

function buildOf(copyOfSaved: SavedCopier, nodeHooks: NodeHookSource): Build {
  const views = createNodeViews(copyOfSaved)
  return {
    resolutions: createResolutions(views),
    suppliesOf: createSupplies(
      (node) => nodeHooks.callbacksOf(node, 'setSupply'),
      views
    )
  }
}

function executableFor(
  node: ExecutableLGraphNode,
  resolvers: DefinedResolvers,
  resolutions: Resolutions,
  suppliesOf: ((graph: LGraph) => GraphSupplies) | undefined
): ExecutableLGraphNode {
  if (!(node instanceof ExecutableNodeDTO)) return node
  const resolve = resolvers.resolverFor(node.node)
  if (resolve) return new ResolvedNodeDTO(node, resolve, resolutions)
  const fed = suppliesOf?.(node.graph).feeding(String(node.node.id))
  return fed ? new SuppliedNodeDTO(node, fed) : node
}
