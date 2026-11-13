import { ExecutableNodeDTO } from '@/lib/litegraph/src/litegraph'

import { savedCopier } from '@/platform/nodeApi/shared/savedCopy'
import type { DefinedResolvers } from '@/platform/nodeApi/v4/defs/defRegistry'
import type { FrontendExecution } from '@/utils/executionUtil'
import { createNodeViews } from './nodeView'
import { createResolutions } from './resolution'
import { ResolvedNodeDTO } from './resolvedNodeDto'

/** How the API takes part in each prompt build. */
export function createFrontendExecution(
  resolvers: DefinedResolvers
): FrontendExecution {
  const copyOfSaved = savedCopier()
  return {
    adoptNodes(nodes) {
      if (!resolvers.any()) return
      const resolutions = createResolutions(createNodeViews(copyOfSaved))
      for (const [id, node] of nodes) {
        const resolve =
          node instanceof ExecutableNodeDTO &&
          resolvers.resolverFor(node.node.type)
        if (resolve) {
          nodes.set(id, new ResolvedNodeDTO(node, resolve, resolutions))
        }
      }
    }
  }
}
