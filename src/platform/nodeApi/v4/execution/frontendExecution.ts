import type { LGraph } from '@/lib/litegraph/src/LGraph'
import { ExecutableNodeDTO } from '@/lib/litegraph/src/litegraph'
import type { ExecutableLGraphNode } from '@/lib/litegraph/src/litegraph'

import { savedCopier } from '@/platform/nodeApi/shared/savedCopy'
import type { DefinedResolvers } from '@/platform/nodeApi/v4/defs/defRegistry'
import type { NodeHookSource } from '@/platform/nodeApi/v4/defs/dispatchContext'
import type { ResolvedSupply } from '@/platform/nodeApi/v4/types'
import type { FrontendExecution } from '@/utils/executionUtil'
import { sourceInGraph } from './graphSource'
import { createNodeViews } from './nodeView'
import { deliverPreview } from './previews'
import { omittedInputs } from './promptProjection'
import { createResolutions } from './resolution'
import type { Resolutions } from './resolution'
import { ResolvedNodeDTO } from './resolvedNodeDto'
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

  function newBuild(): Build {
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
    build: Build,
    supplying: boolean
  ): ExecutableLGraphNode {
    if (!(node instanceof ExecutableNodeDTO)) return node
    const resolve = resolvers.resolverFor(node.node)
    if (resolve) return new ResolvedNodeDTO(node, resolve, build.resolutions)
    const fed =
      supplying && build.suppliesOf(node.graph).feeding(String(node.node.id))
    return fed ? new SuppliedNodeDTO(node, fed) : node
  }

  return {
    prompt: {
      adoptNodes(nodes) {
        const supplying = nodeHooks.demand('setSupply') > 0
        if (!resolvers.any() && !supplying) return
        const build = newBuild()
        for (const [id, node] of nodes) {
          nodes.set(id, executableFor(node, build, supplying))
        }
      },
      omittedInputs: (node) => omittedInputs(node, nodeHooks)
    },
    deliverPreview: (rootGraph, executionId, blob) =>
      deliverPreview(rootGraph, executionId, blob, nodeHooks),
    resolvedSupplies(graph) {
      const { resolutions, suppliesOf } = newBuild()
      return Object.freeze(
        suppliesOf(graph).all.map((supply) =>
          Object.freeze({
            supplierNodeId: String(supply.supplier.id),
            to: Object.freeze({ nodeId: supply.nodeId, input: supply.input }),
            from: sourceInGraph(
              graph,
              supply,
              resolvers.resolverFor,
              resolutions
            )
          })
        )
      )
    }
  }
}
