/**
 * Which root graph, if any, currently shares its node-id space with a remote
 * collaborator (the in-app agent's collaborative doc). `mintNodeId` needs the
 * answer to pick a mint mode (see `idAllocation.ts`), but litegraph must not
 * reach up into the app layer to ask, so the app layer registers a probe
 * here and litegraph pulls it at mint time.
 *
 * Pull, not push: the probe reads the app's own live enabled/doc-bound/graph
 * signal at the moment of the mint, so there is no second copy of that state
 * to keep in sync, go stale, or tear down. The only registrant is
 * `attachMintPortWiring`, which already owns that signal for the mint ports
 * themselves — so a graph mints from the shared-safe range exactly when its
 * edits are being sent to the doc.
 */

/** The root graph id sharing its id space, or `null` when none is. */
export type DocBoundRootGraphProbe = () => string | null

const probes = new Set<DocBoundRootGraphProbe>()

/** Registers `probe` until the returned disposer is called. */
export function registerDocBoundRootGraphProbe(
  probe: DocBoundRootGraphProbe
): () => void {
  probes.add(probe)
  return () => probes.delete(probe)
}

export function isRootGraphDocBound(rootGraphId: string): boolean {
  for (const probe of probes) {
    if (probe() === rootGraphId) return true
  }
  return false
}
