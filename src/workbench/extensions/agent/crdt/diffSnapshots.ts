/**
 * Pure diff between two {@link DocSnapshot}s → an ordered {@link GraphMutation}
 * list (ADR-009). Deterministic and side-effect free, so it carries the
 * follower's correctness guarantees under unit + property tests:
 *   - applying `diff(a, b)` to a graph shaped like `a` yields a graph shaped
 *     like `b` (see semanticProjector.test);
 *   - `diff(a, a)` is empty;
 *   - re-diffing after applying is empty (idempotent convergence).
 *
 * Ordering is load-bearing for the mutator: removals of links before nodes,
 * additions of nodes before the links that reference them.
 */
import type { DocSnapshot } from './docSchema'
import type { GraphMutation, LinkSpec, NodeSpec } from './graphMutations'

function posChanged(a: NodeSpec, b: NodeSpec): boolean {
  return a.pos[0] !== b.pos[0] || a.pos[1] !== b.pos[1]
}

function changedWidgets(
  prev: NodeSpec,
  next: NodeSpec
): Array<{ name: string; value: unknown }> {
  const changed: Array<{ name: string; value: unknown }> = []
  for (const [name, value] of Object.entries(next.widgets)) {
    if (!Object.is(prev.widgets[name], value)) changed.push({ name, value })
  }
  return changed
}

function clearedWidgets(prev: NodeSpec, next: NodeSpec): string[] {
  const cleared: string[] = []
  for (const name of Object.keys(prev.widgets)) {
    if (!(name in next.widgets)) cleared.push(name)
  }
  return cleared
}

function linkChanged(a: LinkSpec, b: LinkSpec): boolean {
  return (
    a.originId !== b.originId ||
    a.originSlot !== b.originSlot ||
    a.targetId !== b.targetId ||
    a.targetSlot !== b.targetSlot
  )
}

export function diffSnapshots(
  prev: DocSnapshot,
  next: DocSnapshot
): GraphMutation[] {
  const mutations: GraphMutation[] = []

  // A node id present in both snapshots with a different `type` cannot be
  // reconciled in place - the LiteGraph class would be wrong - so it is
  // replaced: its links drop and re-add around an ordered remove + add.
  const retyped = new Set<string>()
  for (const [id, node] of next.nodes) {
    const before = prev.nodes.get(id)
    if (before && before.type !== node.type) retyped.add(id)
  }
  const touchesRetyped = (link: LinkSpec): boolean =>
    retyped.has(String(link.originId)) || retyped.has(String(link.targetId))

  // 1. Drop links that are gone, rewired, or attached to a replaced node
  //    (before node removal, so the target still exists when we disconnect
  //    its input).
  for (const [id, link] of prev.links) {
    const nextLink = next.links.get(id)
    if (!nextLink || linkChanged(link, nextLink) || touchesRetyped(link)) {
      mutations.push({
        kind: 'disconnect',
        id,
        targetId: link.targetId,
        targetSlot: link.targetSlot
      })
    }
  }

  // 2. Remove nodes that are gone or replaced.
  for (const id of prev.nodes.keys()) {
    const node = prev.nodes.get(id)
    if (node && (!next.nodes.has(id) || retyped.has(id))) {
      mutations.push({ kind: 'remove_node', id: node.id })
    }
  }

  // 3. Add new and replaced nodes, then reconcile survivors (position +
  //    widgets, including previous-only widget keys as explicit clears).
  for (const [id, node] of next.nodes) {
    const before = prev.nodes.get(id)
    if (!before || retyped.has(id)) {
      mutations.push({ kind: 'add_node', node })
      continue
    }
    if (posChanged(before, node)) {
      mutations.push({ kind: 'move_node', id: node.id, pos: node.pos })
    }
    for (const { name, value } of changedWidgets(before, node)) {
      mutations.push({ kind: 'set_widget', id: node.id, name, value })
    }
    for (const name of clearedWidgets(before, node)) {
      mutations.push({ kind: 'clear_widget', id: node.id, name })
    }
  }

  // 4. Add links that are new, rewired, or re-attached to a replaced node
  //    (after their endpoints exist).
  for (const [id, link] of next.links) {
    const prevLink = prev.links.get(id)
    if (!prevLink || linkChanged(prevLink, link) || touchesRetyped(link)) {
      mutations.push({ kind: 'connect', link })
    }
  }

  return mutations
}
