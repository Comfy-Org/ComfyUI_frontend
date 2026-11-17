import type { LGraph } from '@comfyorg/graph-model/entityRegistry'
import { reportError } from '@comfyorg/telemetry/reportError'

import { graphIntentSource } from './graphIntents'
import type { GraphIntentSource } from './graphIntents'

interface CompletedGraphEdit {
  graph: LGraph
  source: GraphIntentSource
  outcome: 'completed' | 'interrupted'
}

interface EditOwner {
  owner: object
  complete: (edit: CompletedGraphEdit) => void
}

interface EditScope {
  binding: EditOwner
  changed: boolean
}

const owners = new WeakMap<LGraph['state'], EditOwner>()
const scopes = new WeakMap<LGraph['state'], Map<GraphIntentSource, EditScope>>()
const activeScopes = new Set<EditScope>()

export function bindGraphEditOwner(
  graph: LGraph,
  owner: object,
  complete: EditOwner['complete']
): void {
  owners.set(graph.rootGraph.state, { owner, complete })
}

export function isGraphEditActive(owner: object): boolean {
  return [...activeScopes].some((scope) => scope.binding.owner === owner)
}

export function noteGraphEdit(graph: LGraph): void {
  const scope = scopes.get(graph.rootGraph.state)?.get(graphIntentSource())
  if (scope) scope.changed = true
}

export function withGraphEdit<T>(
  graph: LGraph | null | undefined,
  action: () => T
): T {
  if (!graph) return action()
  const root = graph.rootGraph
  const state = root.state
  const binding = owners.get(state)
  if (!binding) return action()
  const source = graphIntentSource()
  const groups = scopes.get(state) ?? new Map<GraphIntentSource, EditScope>()
  if (groups.has(source)) return action()

  const scope: EditScope = { binding, changed: false }
  groups.set(source, scope)
  scopes.set(state, groups)
  activeScopes.add(scope)
  let outcome: CompletedGraphEdit['outcome'] = 'interrupted'
  try {
    const result = action()
    outcome = 'completed'
    return result
  } finally {
    groups.delete(source)
    activeScopes.delete(scope)
    if (groups.size === 0) scopes.delete(state)
    if (
      scope.changed &&
      root.state === state &&
      owners.get(state) === binding
    ) {
      try {
        binding.complete({ graph: root, source, outcome })
      } catch (error) {
        reportError(error, {
          surface: 'graph',
          errorType: 'graph_edit_completion_failed',
          context: { source, outcome }
        })
      }
    }
  }
}
