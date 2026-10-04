import { expect } from '@playwright/test'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

const STALL_EXTENSION = 'e2e.op329.stallBeforeLoadGraph'

function noteWorkflow(title: string): ComfyWorkflowJSON {
  return {
    last_node_id: 1,
    last_link_id: 0,
    nodes: [
      {
        id: 1,
        type: 'Note',
        title,
        pos: [120, 120],
        size: [260, 120],
        flags: {},
        order: 0,
        mode: 0,
        properties: {},
        widgets_values: ['']
      }
    ],
    links: [],
    groups: [],
    config: {},
    extra: {},
    version: 0.4
  }
}

test.describe(
  'Overlapping workflow loads',
  { tag: ['@cloud', '@vue-nodes'] },
  () => {
    test('the newer workflow survives an older load resuming', async ({
      comfyPage
    }) => {
      test.setTimeout(60_000)
      const { page, vueNodes } = comfyPage

      await test.step('hold the first load open, then start a second', async () => {
        await page.evaluate(
          async ([extensionName, older, newer]) => {
            let release!: () => void
            const held = new Promise<void>((resolve) => {
              release = resolve
            })
            let holdNext = true
            window.app!.registerExtension({
              name: extensionName,
              beforeLoadGraph: async () => {
                if (!holdNext) return
                holdNext = false
                await held
              }
            })

            const olderLoad = window.app!.loadGraphData(older)
            const newerLoad = window.app!.loadGraphData(newer)
            await newerLoad
            release()
            await olderLoad
          },
          [
            STALL_EXTENSION,
            noteWorkflow('older workflow'),
            noteWorkflow('newer workflow')
          ] as const
        )
      })

      await test.step('the canvas still shows the newer workflow', async () => {
        await expect(vueNodes.nodes).toHaveCount(1)
        await expect(
          vueNodes.getNodeByTitle('newer workflow').first()
        ).toBeVisible()
        await expect(vueNodes.getNodeByTitle('older workflow')).toHaveCount(0)
      })
    })

    test('the newer workflow survives a superseded API JSON import', async ({
      comfyPage
    }) => {
      test.setTimeout(60_000)
      const { page, vueNodes } = comfyPage

      await test.step('hold an API JSON import open, then load a workflow', async () => {
        await page.evaluate(
          async ([extensionName, apiPrompt, newer]) => {
            let release!: () => void
            const held = new Promise<void>((resolve) => {
              release = resolve
            })
            let holdNext = true
            window.app!.registerExtension({
              name: extensionName,
              beforeLoadGraph: async () => {
                if (!holdNext) return
                holdNext = false
                await held
              }
            })

            const apiImport = window.app!.loadApiJson(
              apiPrompt,
              'superseded-api-prompt.json'
            )
            await window.app!.loadGraphData(newer)
            release()
            await apiImport
          },
          [
            `${STALL_EXTENSION}.apiJson`,
            {
              '1': {
                class_type: 'EmptyLatentImage',
                inputs: {},
                _meta: { title: 'superseded api import' }
              }
            },
            noteWorkflow('newer workflow')
          ] as const
        )
      })

      await test.step('the canvas still shows the newer workflow', async () => {
        await expect(vueNodes.nodes).toHaveCount(1)
        await expect(
          vueNodes.getNodeByTitle('newer workflow').first()
        ).toBeVisible()
        await expect(
          vueNodes.getNodeByTitle('superseded api import')
        ).toHaveCount(0)
      })
    })
  }
)
