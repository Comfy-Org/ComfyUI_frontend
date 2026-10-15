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
    test('workflow loads finish in FIFO order', async ({ comfyPage }) => {
      test.setTimeout(60_000)
      const { page, vueNodes } = comfyPage

      const order =
        await test.step('hold the first load open, then queue a second', async () =>
          await page.evaluate(
            async ([extensionName, older, newer]) => {
              let release!: () => void
              const held = new Promise<void>((resolve) => {
                release = resolve
              })
              let entered!: () => void
              const firstEntered = new Promise<void>((resolve) => {
                entered = resolve
              })
              let holdNext = true
              let beforeLoadGraphCalls = 0
              window.app!.registerExtension({
                name: extensionName,
                beforeLoadGraph: async () => {
                  beforeLoadGraphCalls++
                  if (!holdNext) return
                  holdNext = false
                  entered()
                  await held
                }
              })

              const order: string[] = []
              const olderLoad = window.app!.loadGraphData(older)
              await firstEntered
              const newerLoad = window
                .app!.loadGraphData(newer)
                .then(() => order.push('newer'))
              await Promise.resolve()
              const loadsStartedWhileOlderWasHeld = beforeLoadGraphCalls
              release()
              await olderLoad.then(() => order.push('older'))
              await newerLoad
              return { order, loadsStartedWhileOlderWasHeld }
            },
            [
              STALL_EXTENSION,
              noteWorkflow('older workflow'),
              noteWorkflow('newer workflow')
            ] as const
          ))

      expect(order).toEqual({
        order: ['older', 'newer'],
        loadsStartedWhileOlderWasHeld: 1
      })

      await test.step('the canvas shows the last queued workflow', async () => {
        await expect(vueNodes.nodes).toHaveCount(1)
        await expect(
          vueNodes.getNodeByTitle('newer workflow').first()
        ).toBeVisible()
        await expect(vueNodes.getNodeByTitle('older workflow')).toHaveCount(0)
      })
    })

    test('a workflow waits for an earlier API JSON import', async ({
      comfyPage
    }) => {
      test.setTimeout(60_000)
      const { page, vueNodes } = comfyPage

      const order =
        await test.step('hold an API JSON import open, then queue a workflow', async () =>
          await page.evaluate(
            async ([extensionName, apiPrompt, newer]) => {
              let release!: () => void
              const held = new Promise<void>((resolve) => {
                release = resolve
              })
              let entered!: () => void
              const firstEntered = new Promise<void>((resolve) => {
                entered = resolve
              })
              let holdNext = true
              window.app!.registerExtension({
                name: extensionName,
                beforeLoadGraph: async () => {
                  if (!holdNext) return
                  holdNext = false
                  entered()
                  await held
                }
              })

              const order: string[] = []
              const apiImport = window
                .app!.loadApiJson(apiPrompt, 'queued-api-prompt.json')
                .then(() => order.push('api'))
              await firstEntered
              const workflowLoad = window
                .app!.loadGraphData(newer)
                .then(() => order.push('workflow'))
              await Promise.resolve()
              const workflowFinishedWhileApiWasHeld = order.includes('workflow')
              release()
              await apiImport
              await workflowLoad
              return { order, workflowFinishedWhileApiWasHeld }
            },
            [
              `${STALL_EXTENSION}.apiJson`,
              {
                '1': {
                  class_type: 'EmptyLatentImage',
                  inputs: {},
                  _meta: { title: 'queued api import' }
                }
              },
              noteWorkflow('newer workflow')
            ] as const
          ))

      expect(order).toEqual({
        order: ['api', 'workflow'],
        workflowFinishedWhileApiWasHeld: false
      })

      await test.step('the canvas shows the last queued workflow', async () => {
        await expect(vueNodes.nodes).toHaveCount(1)
        await expect(
          vueNodes.getNodeByTitle('newer workflow').first()
        ).toBeVisible()
        await expect(vueNodes.getNodeByTitle('queued api import')).toHaveCount(
          0
        )
      })
    })
  }
)
