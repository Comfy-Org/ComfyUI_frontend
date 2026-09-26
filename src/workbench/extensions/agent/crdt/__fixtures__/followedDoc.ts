import { mint } from '@comfyorg/comfy-multi-player'
import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'
import { onTestFinished } from 'vitest'
import * as Y from 'yjs'

import { DocChangeCollector } from '../docChangeCollector'

/**
 * A follower document that received the minted `workflow` as its catch-up
 * frame, with a collector that observed every entry arrive. `collector.take()`
 * therefore holds what the applier sees when a fresh follower catches up.
 */
export function followedDoc(workflow: WorkflowJSON, catalog: WidgetCatalog) {
  const host = mint(workflow, catalog)
  const doc = new Y.Doc()
  const collector = new DocChangeCollector(doc)
  Y.applyUpdate(doc, Y.encodeStateAsUpdate(host))
  host.destroy()
  onTestFinished(() => {
    collector.destroy()
    doc.destroy()
  })
  return { doc, collector }
}
