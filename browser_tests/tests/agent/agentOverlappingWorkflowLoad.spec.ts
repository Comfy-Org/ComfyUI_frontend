import { expect } from '@playwright/test'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'

/**
 * Regression for https://github.com/Comfy-Org/ComfyUI_frontend/issues/19971:
 * "Reject a superseded graph load before its first destructive store/canvas
 * mutation" and "Re-check graph-load ownership after awaited lifecycle hooks".
 *
 * `loadGraphData` awaits `beforeLoadGraph` and then immediately clears the
 * canvas and the resource stores, but it did not compare its own load id with
 * the committed one until well after that. So when two loads overlap — the
 * user switching workflows faster than the first load resolves, or any
 * extension holding `beforeLoadGraph` open — the older load woke up, erased
 * the graph the newer load had already committed, and only then reported
 * itself superseded. The canvas was left holding the workflow the user had
 * navigated away from, or nothing at all.
 */
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
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test('the newer workflow survives an older load resuming', async ({
      comfyPage,
      agentPanel
    }) => {
      test.setTimeout(60_000)
      const { page, vueNodes } = comfyPage

      await agentPanel.open()
      await vueNodes.setEnabled(true)

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

            const olderLoad = window.app!.loadGraphData(older as never)
            const newerLoad = window.app!.loadGraphData(newer as never)
            // The newer load runs to completion and commits its graph while
            // the older one is still parked inside `beforeLoadGraph`.
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

    /**
     * The same defect in the sibling entry point. An API-JSON import awaits the
     * same `beforeLoadGraph` hook and then runs the same destructive
     * `setGraph()`/`clean()` pair, but took no part in the ownership sequence
     * `loadGraphData` commits to — so it both erased a newer committed graph
     * and could itself be erased by a load that was still suspended.
     */
    test('the newer workflow survives a superseded API JSON import', async ({
      comfyPage,
      agentPanel
    }) => {
      test.setTimeout(60_000)
      const { page, vueNodes } = comfyPage

      await agentPanel.open()
      await vueNodes.setEnabled(true)

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
            // The workflow load commits while the import is parked inside
            // `beforeLoadGraph`, before the import has touched the canvas.
            await window.app!.loadGraphData(newer as never)
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
