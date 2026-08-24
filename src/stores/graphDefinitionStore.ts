import { defineStore } from 'pinia'

import type {
  IGraphGroupFlags,
  LGraphGroup
} from '@/lib/litegraph/src/LGraphGroup'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { Subgraph, SubgraphId } from '@/lib/litegraph/src/LGraph'
import type { SubgraphInput } from '@/lib/litegraph/src/subgraph/SubgraphInput'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { SubgraphOutput } from '@/lib/litegraph/src/subgraph/SubgraphOutput'
import type { ExposedWidget } from '@/lib/litegraph/src/types/serialisation'
import type { GroupId } from '@/types/groupId'
import type { UUID } from '@/utils/uuid'

export interface GroupPresentation {
  title: string
  color?: string
  font?: string
  font_size: number
  flags: IGraphGroupFlags
}

interface GraphMembership {
  nodes: (LGraphNode | SubgraphNode)[]
  groups: LGraphGroup[]
  groupPresentation: Map<GroupId, GroupPresentation>
}

interface SubgraphDefinition {
  name: string
  description?: string
  inputs: SubgraphInput[]
  outputs: SubgraphOutput[]
  widgets: ExposedWidget[]
}

interface RootDefinitions {
  membershipByGraph: Map<UUID, GraphMembership>
  subgraphs: Map<SubgraphId, Subgraph>
  definitions: Map<SubgraphId, SubgraphDefinition>
}

export const useGraphDefinitionStore = defineStore('graphDefinition', () => {
  const roots = new Map<UUID, RootDefinitions>()

  function root(rootGraphId: UUID): RootDefinitions {
    const existing = roots.get(rootGraphId)
    if (existing) return existing
    const created: RootDefinitions = {
      membershipByGraph: new Map(),
      subgraphs: new Map(),
      definitions: new Map()
    }
    roots.set(rootGraphId, created)
    return created
  }

  function membership(rootGraphId: UUID, graphId: UUID): GraphMembership {
    const definitions = root(rootGraphId)
    const existing = definitions.membershipByGraph.get(graphId)
    if (existing) return existing
    const created: GraphMembership = {
      nodes: [],
      groups: [],
      groupPresentation: new Map()
    }
    definitions.membershipByGraph.set(graphId, created)
    return created
  }

  function subgraphs(rootGraphId: UUID) {
    return root(rootGraphId).subgraphs
  }

  function registerGroupPresentation(
    rootGraphId: UUID,
    graphId: UUID,
    groupId: GroupId,
    presentation: GroupPresentation
  ): GroupPresentation {
    const presentations = membership(rootGraphId, graphId).groupPresentation
    presentations.set(groupId, presentation)
    return presentations.get(groupId)!
  }

  function deleteGroupPresentation(
    rootGraphId: UUID,
    graphId: UUID,
    groupId: GroupId
  ): void {
    membership(rootGraphId, graphId).groupPresentation.delete(groupId)
  }

  function definition(
    rootGraphId: UUID,
    subgraphId: SubgraphId
  ): SubgraphDefinition {
    const definitions = root(rootGraphId)
    const existing = definitions.definitions.get(subgraphId)
    if (existing) return existing
    const created: SubgraphDefinition = {
      name: 'Unnamed Subgraph',
      inputs: [],
      outputs: [],
      widgets: []
    }
    definitions.definitions.set(subgraphId, created)
    return created
  }

  function rekeyRoot(previousId: UUID, nextId: UUID): void {
    if (previousId === nextId) return
    const existing = roots.get(previousId)
    if (!existing) return
    roots.delete(previousId)
    const rootMembership = existing.membershipByGraph.get(previousId)
    if (rootMembership) {
      existing.membershipByGraph.delete(previousId)
      existing.membershipByGraph.set(nextId, rootMembership)
    }
    roots.set(nextId, existing)
  }

  function hasRoot(rootGraphId: UUID): boolean {
    return roots.has(rootGraphId)
  }

  function hasGraph(rootGraphId: UUID, graphId: UUID): boolean {
    const definitions = roots.get(rootGraphId)
    return Boolean(
      definitions?.subgraphs.has(graphId) ||
      definitions?.membershipByGraph.has(graphId) ||
      definitions?.definitions.has(graphId)
    )
  }

  function rekeyGraph(
    rootGraphId: UUID,
    previousId: SubgraphId,
    nextId: SubgraphId
  ): void {
    if (previousId === nextId) return
    const definitions = roots.get(rootGraphId)
    if (!definitions) return
    const subgraph = definitions.subgraphs.get(previousId)
    if (subgraph) {
      definitions.subgraphs.delete(previousId)
      definitions.subgraphs.set(nextId, subgraph)
    }
    const membership = definitions.membershipByGraph.get(previousId)
    if (membership) {
      definitions.membershipByGraph.delete(previousId)
      definitions.membershipByGraph.set(nextId, membership)
    }
    const definition = definitions.definitions.get(previousId)
    if (definition) {
      definitions.definitions.delete(previousId)
      definitions.definitions.set(nextId, definition)
    }
  }

  function clearRoot(rootGraphId: UUID): void {
    roots.delete(rootGraphId)
  }

  function clearGraph(rootGraphId: UUID, graphId: UUID): void {
    const definitions = roots.get(rootGraphId)
    definitions?.membershipByGraph.delete(graphId)
    definitions?.definitions.delete(graphId)
  }

  return {
    clearGraph,
    clearRoot,
    deleteGroupPresentation,
    definition,
    hasGraph,
    hasRoot,
    membership,
    registerGroupPresentation,
    rekeyGraph,
    rekeyRoot,
    subgraphs
  }
})
