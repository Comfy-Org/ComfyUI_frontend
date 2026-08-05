/**
 * State shared by every stub and read back by the harness.
 *
 * A separate module because the stubs are reached through the loader hook, and
 * importing one instance from each of them is what guarantees they agree on
 * which graph the pack is talking to.
 */
import { LGraph } from '@/lib/litegraph/src/litegraph'

export const registry = {
  extensions: [],
  graph: new LGraph(),
  reset() {
    this.extensions = []
    this.graph = new LGraph()
  }
}
