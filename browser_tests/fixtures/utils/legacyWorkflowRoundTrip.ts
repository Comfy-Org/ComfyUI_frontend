import { readFileSync } from 'node:fs'

import type { ComfyWorkflowJSON } from '@comfyorg/graph-model/workflowSchema'
import { zComfyWorkflow } from '@comfyorg/graph-model/workflowSchema'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'

export type WorkflowProjection = ReturnType<typeof projectWorkflow>
type ProjectedWorkflowInput =
  WorkflowProjection['nodes'][number]['inputs'][string]

/**
 * The widget inputs that saving promotes onto each node, keyed by input name.
 *
 * Deliberately keyed rather than ordered: the frontend places promoted widget
 * inputs in node-definition order, interleaved with the link inputs, and that
 * placement is a storage convention rather than a round-trip guarantee. What
 * the round trip must preserve is that each input exists with the right type
 * and widget binding — see `projectWorkflow`.
 */
const canonicalWidgetInputsByNodeId: Readonly<
  Record<string, Readonly<Record<string, ProjectedWorkflowInput>>>
> = {
  3: {
    seed: { type: 'INT', link: null, widget: { name: 'seed' } },
    steps: { type: 'INT', link: null, widget: { name: 'steps' } },
    cfg: { type: 'FLOAT', link: null, widget: { name: 'cfg' } },
    sampler_name: {
      type: 'COMBO',
      link: null,
      widget: { name: 'sampler_name' }
    },
    scheduler: { type: 'COMBO', link: null, widget: { name: 'scheduler' } },
    denoise: { type: 'FLOAT', link: null, widget: { name: 'denoise' } }
  },
  4: {
    ckpt_name: { type: 'COMBO', link: null, widget: { name: 'ckpt_name' } }
  },
  5: {
    width: { type: 'INT', link: null, widget: { name: 'width' } },
    height: { type: 'INT', link: null, widget: { name: 'height' } },
    batch_size: { type: 'INT', link: null, widget: { name: 'batch_size' } }
  },
  6: { text: { type: 'STRING', link: null, widget: { name: 'text' } } },
  7: { text: { type: 'STRING', link: null, widget: { name: 'text' } } },
  9: {
    filename_prefix: {
      type: 'STRING',
      link: null,
      widget: { name: 'filename_prefix' }
    }
  }
}

export const legacyWorkflowFixture = zComfyWorkflow.parse(
  JSON.parse(
    readFileSync(
      new URL(
        '../../assets/legacy-v1.52.5-entity-roundtrip.json',
        import.meta.url
      ),
      'utf-8'
    )
  )
)

interface NormalisedLink {
  id: number
  originId: unknown
  originSlot: number
  targetId: unknown
  targetSlot: number
  type: unknown
}

/**
 * `ComfyWorkflowJSON` spans schema 0.4 (links as `[id, originId, originSlot,
 * targetId, targetSlot, type]` tuples) and schema 1.0 (links as objects), so
 * read whichever shape arrived into one form.
 */
function normaliseLink(link: unknown): NormalisedLink {
  if (Array.isArray(link)) {
    const [id, originId, originSlot, targetId, targetSlot, type] = link
    return {
      id: Number(id),
      originId,
      originSlot: Number(originSlot),
      targetId,
      targetSlot: Number(targetSlot),
      type
    }
  }
  const l = link as {
    id: number
    origin_id: unknown
    origin_slot: number
    target_id: unknown
    target_slot: number
    type: unknown
  }
  return {
    id: l.id,
    originId: l.origin_id,
    originSlot: l.origin_slot,
    targetId: l.target_id,
    targetSlot: l.target_slot,
    type: l.type
  }
}

/**
 * Projects a workflow onto the state a round trip must preserve, deliberately
 * free of two storage conventions that the graph API rewrite changed and that
 * the persisted format never promised:
 *
 * - Link emission order follows link-store insertion, not link id, so links
 *   are compared as a set ordered by id.
 * - Promoted widget inputs are placed in node-definition order, interleaved
 *   with link inputs, which renumbers every link's `target_slot`. So inputs
 *   are keyed by name and each link's target is resolved to the *name* of the
 *   input it lands on rather than its index.
 *
 * Every value is still asserted exactly; only the indexing is normalised.
 */
export function projectWorkflow(workflow: ComfyWorkflowJSON) {
  const inputNameAt = (nodeId: unknown, slot: number): string => {
    const node = workflow.nodes.find((n) => String(n.id) === String(nodeId))
    return node?.inputs?.[slot]?.name ?? `<unresolved slot ${slot}>`
  }
  const outputNameAt = (nodeId: unknown, slot: number): string => {
    const node = workflow.nodes.find((n) => String(n.id) === String(nodeId))
    return node?.outputs?.[slot]?.name ?? `<unresolved slot ${slot}>`
  }

  return {
    nodes: workflow.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      pos: node.pos,
      size: node.size,
      order: node.order,
      mode: node.mode,
      flags: node.flags,
      properties: node.properties,
      widgetsValues: node.widgets_values,
      widgetsValuesNamed: node.widgets_values_named,
      inputs: Object.fromEntries(
        (node.inputs ?? []).map(({ name, type, link, widget }) => [
          name,
          { type, link, widget }
        ])
      ),
      outputs: node.outputs?.map(
        ({ name, type, links, slot_index: slotIndex }) => ({
          name,
          type,
          links,
          slotIndex
        })
      )
    })),
    links: (workflow.links ?? [])
      .map(normaliseLink)
      .sort((a, b) => a.id - b.id)
      .map(({ id, originId, originSlot, targetId, targetSlot, type }) => ({
        id,
        originId,
        originOutput: outputNameAt(originId, originSlot),
        targetId,
        targetInput: inputNameAt(targetId, targetSlot),
        type
      })),
    groups: workflow.groups,
    reroutes: workflow.extra?.reroutes,
    linkExtensions: workflow.extra?.linkExtensions
  }
}

export function expectedCanonicalPersistence(
  workflow: WorkflowProjection
): WorkflowProjection {
  return {
    ...workflow,
    nodes: workflow.nodes.map((node) => ({
      ...node,
      inputs: {
        ...node.inputs,
        ...canonicalWidgetInputsByNodeId[String(node.id)]
      }
    }))
  }
}

export async function exportedProjection(
  comfyPage: ComfyPage
): Promise<WorkflowProjection> {
  return projectWorkflow(await comfyPage.workflow.getExportedWorkflow())
}

export async function persistedProjection(
  comfyPage: ComfyPage,
  path: string
): Promise<WorkflowProjection> {
  const contents = await comfyPage.page.evaluate(async (workflowPath) => {
    const response = await window.app!.api.getUserData(workflowPath)
    return response.text()
  }, path)
  return projectWorkflow(zComfyWorkflow.parse(JSON.parse(contents)))
}

export async function persistedWorkflowPaths(
  comfyPage: ComfyPage
): Promise<string[]> {
  return comfyPage.page.evaluate(async () => {
    const workflows = await window.app!.api.listUserDataFullInfo('workflows')
    return workflows.map(({ path }) => path)
  })
}
