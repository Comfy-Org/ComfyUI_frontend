import { ref } from 'vue'

/**
 * Bumped whenever graph structure changes in a way plain instance state
 * cannot announce: node add/remove, clear/configure, graph switch,
 * subgraph conversion. Derivations over graph structure track it.
 */
const revision = ref(0)

export function trackGraphStructure(): void {
  void revision.value
}

export function bumpGraphStructureRevision(): void {
  revision.value++
}
