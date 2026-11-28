import { fromPartial } from '@total-typescript/shoehorn'

import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { registerApp } from '@/scripts/appRegistry'

/** Registers an app whose root graph is the given graph, or no graph so widgets resolve from the widget value store alone. */
export function registerStorybookApp(rootGraph?: LGraph) {
  registerApp(
    fromPartial<Parameters<typeof registerApp>[0]>({
      isGraphReady: !!rootGraph,
      rootGraph
    })
  )
}
