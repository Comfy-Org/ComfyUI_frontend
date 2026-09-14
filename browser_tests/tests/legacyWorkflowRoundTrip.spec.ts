import { readFileSync } from 'node:fs'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { zComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

type WorkflowProjection = ReturnType<typeof projectWorkflow>
type CanonicalWidgetInput = {
  name: string
  type: string
  link: null
  widget: { name: string }
}

const canonicalWidgetInputsByNodeId: Readonly<
  Record<string, readonly CanonicalWidgetInput[]>
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

const fixture = JSON.parse(
  readFileSync(
    new URL('../assets/legacy-v1.52.5-entity-roundtrip.json', import.meta.url),
    'utf-8'
  )
) as ComfyWorkflowJSON

function projectWorkflow(workflow: ComfyWorkflowJSON) {
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

function expectedCanonicalPersistence(
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

async function exportedProjection(
  comfyPage: ComfyPage
): Promise<WorkflowProjection> {
  return projectWorkflow(await comfyPage.workflow.getExportedWorkflow())
}

async function persistedProjection(
  comfyPage: ComfyPage,
  path: string
): Promise<WorkflowProjection> {
  const contents = await comfyPage.page.evaluate(async (workflowPath) => {
    const response = await window.app!.api.getUserData(workflowPath)
    return response.text()
  }, path)
  return projectWorkflow(zComfyWorkflow.parse(JSON.parse(contents)))
}

async function persistedWorkflowPaths(comfyPage: ComfyPage): Promise<string[]> {
  return comfyPage.page.evaluate(async () => {
    const workflows = await window.app!.api.listUserDataFullInfo('workflows')
    return workflows.map(({ path }) => path)
  })
}

for (const vueNodesEnabled of [false, true]) {
  test.describe(
    `legacy workflow save and full reload with VueNodes=${vueNodesEnabled}`,
    {
      tag: vueNodesEnabled
        ? ['@canvas', '@widget', '@vue-nodes']
        : ['@canvas', '@widget']
    },
    () => {
      const savedName = `legacy-v1.52.5-resaved-${
        vueNodesEnabled ? 'vue' : 'litegraph'
      }`
      const savedFilename = `${savedName}.json`
      const savedPath = `workflows/${savedFilename}`

      test.afterEach(async ({ comfyPage }) => {
        const status = await comfyPage.page.evaluate(async (workflowPath) => {
          const response = await window.app!.api.deleteUserData(workflowPath)
          return response.status
        }, savedPath)
        expect([204, 404]).toContain(status)
      })

      test('preserves exact nodes, links, groups, reroutes, and widget values', async ({
        comfyPage
      }) => {
        test.slow()
        test.info().annotations.push({
          type: 'fixture-provenance',
          description:
            'Generated by the frontend v1.52.5 tag (abf63b48b3) from repository fixture 7972550f6b, then saved by its graph serializer'
        })

        const expected = projectWorkflow(fixture)
        const expectedPersisted = expectedCanonicalPersistence(expected)
        expect(expected.nodes.length).toBeGreaterThan(0)
        expect(expected.links?.length).toBeGreaterThan(0)
        expect(expected.groups?.length).toBeGreaterThan(0)
        expect(expected.reroutes?.length).toBeGreaterThan(0)
        expect(
          expected.nodes.filter(({ widgetsValues }) => widgetsValues?.length)
            .length
        ).toBeGreaterThan(0)

        await comfyPage.workflow.loadWorkflow('legacy-v1.52.5-entity-roundtrip')
        expect(await exportedProjection(comfyPage)).toEqual(expected)

        await comfyPage.menu.topbar.saveWorkflowAs(savedName)

        await expect
          .poll(() => comfyPage.workflow.getActiveWorkflowPath())
          .toBe(savedPath)
        await expect
          .poll(() => persistedWorkflowPaths(comfyPage))
          .toContain(savedFilename)
        expect(await persistedProjection(comfyPage, savedPath)).toEqual(
          expectedPersisted
        )

        await comfyPage.workflow.reloadAndWaitForApp()

        await expect
          .poll(() => comfyPage.workflow.getActiveWorkflowPath())
          .toBe(savedPath)
        await expect
          .poll(() => persistedWorkflowPaths(comfyPage))
          .toContain(savedFilename)
        expect(await persistedProjection(comfyPage, savedPath)).toEqual(
          expectedPersisted
        )
        await expect.poll(() => exportedProjection(comfyPage)).toEqual(expected)
      })
    }
  )
}
