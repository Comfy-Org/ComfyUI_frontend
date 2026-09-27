import type { Page } from '@playwright/test'

import {
  FIRST_REFERENCE_INPUT,
  REFERENCE_NODE_ID,
  SEED_INPUT,
  SEED_SOURCE_NODE_ID,
  SOURCE_NODE_ID
} from '@e2e/fixtures/data/minimaxAutogrowReload'
import type { LinkId } from '@/types/linkId'

const NEXT_REFERENCE_INPUT = 'model.reference_images.image_2'

export interface ReferenceWiring {
  /** Reopening grew the next image input, moving every later slot. */
  hasNextReference: boolean
  /** The image wire survived that growth. */
  referenceLinked: boolean
  /** The widget-input wire's link id before the reopen. */
  seedLinkBefore: LinkId | null | undefined
  /** The same input's link id after it, which must be unchanged. */
  seedLinkAfter: LinkId | null | undefined
}

/**
 * Wires both sources into the reference node, saves and reopens the workflow
 * the way loading does, and reports what the reopened node holds. The report
 * is read from the graph because the defect is a silent re-target: the wire
 * still paints, just into the wrong input.
 */
export async function wireAndReopen(page: Page): Promise<ReferenceWiring> {
  return page.evaluate(
    ({
      sourceId,
      seedSourceId,
      referenceId,
      firstReference,
      nextReference,
      seed
    }) => {
      const graph = window.app!.graph
      const byId = (id: number) =>
        graph._nodes.find((node) => String(node.id) === String(id))!
      const source = byId(sourceId)
      const seedSource = byId(seedSourceId)
      const target = byId(referenceId)

      seedSource.connect(0, target, target.findInputSlot(seed))
      const seedLinkBefore = target.inputs[target.findInputSlot(seed)].link
      source.connect(0, target, target.findInputSlot(firstReference))

      graph.configure(structuredClone(graph.serialize()))

      const reopened = byId(referenceId)
      return {
        hasNextReference: reopened.findInputSlot(nextReference) >= 0,
        referenceLinked:
          reopened.inputs[reopened.findInputSlot(firstReference)].link != null,
        seedLinkBefore,
        seedLinkAfter: reopened.inputs[reopened.findInputSlot(seed)].link
      }
    },
    {
      sourceId: SOURCE_NODE_ID,
      seedSourceId: SEED_SOURCE_NODE_ID,
      referenceId: REFERENCE_NODE_ID,
      firstReference: FIRST_REFERENCE_INPUT,
      nextReference: NEXT_REFERENCE_INPUT,
      seed: SEED_INPUT
    }
  )
}
