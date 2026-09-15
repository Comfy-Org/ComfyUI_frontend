import { readFileSync } from 'node:fs'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { zComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'

export type WorkflowProjection = ReturnType<typeof projectWorkflow>
type ProjectedWorkflowInput = NonNullable<
  WorkflowProjection['nodes'][number]['inputs']
>[number]

const canonicalWidgetInputsByNodeId: Readonly<
  Record<string, readonly ProjectedWorkflowInput[]>
> = {
  3: [
    { name: 'seed', type: 'INT', link: null, widget: { name: 'seed' } },
    { name: 'steps', type: 'INT', link: null, widget: { name: 'steps' } },
    { name: 'cfg', type: 'FLOAT', link: null, widget: { name: 'cfg' } },
    {
      name: 'sampler_name',
      type: 'COMBO',
      link: null,
      widget: { name: 'sampler_name' }
    },
    {
      name: 'scheduler',
      type: 'COMBO',
      link: null,
      widget: { name: 'scheduler' }
    },
    {
      name: 'denoise',
      type: 'FLOAT',
      link: null,
      widget: { name: 'denoise' }
    }
  ],
  4: [
    {
      name: 'ckpt_name',
      type: 'COMBO',
      link: null,
      widget: { name: 'ckpt_name' }
    }
  ],
  5: [
    { name: 'width', type: 'INT', link: null, widget: { name: 'width' } },
    { name: 'height', type: 'INT', link: null, widget: { name: 'height' } },
    {
      name: 'batch_size',
      type: 'INT',
      link: null,
      widget: { name: 'batch_size' }
    }
  ],
  6: [{ name: 'text', type: 'STRING', link: null, widget: { name: 'text' } }],
  7: [{ name: 'text', type: 'STRING', link: null, widget: { name: 'text' } }],
  9: [
    {
      name: 'filename_prefix',
      type: 'STRING',
      link: null,
      widget: { name: 'filename_prefix' }
    }
  ]
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

export function projectWorkflow(workflow: ComfyWorkflowJSON) {
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
      inputs: node.inputs?.map(({ name, type, link, widget }) => ({
        name,
        type,
        link,
        widget
      })),
      outputs: node.outputs?.map(
        ({ name, type, links, slot_index: slotIndex }) => ({
          name,
          type,
          links,
          slotIndex
        })
      )
    })),
    links: workflow.links,
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
      inputs: [
        ...(node.inputs ?? []),
        ...(canonicalWidgetInputsByNodeId[String(node.id)] ?? [])
      ]
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
