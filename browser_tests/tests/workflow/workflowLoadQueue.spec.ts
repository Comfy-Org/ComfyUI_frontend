import { expect } from '@playwright/test'

import type { ComfyWorkflowJSON } from '@comfyorg/graph-model/workflowSchema'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

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

test.describe('Workflow load queue', { tag: '@vue-nodes' }, () => {
  test('workflow loads finish in FIFO order', async ({ comfyPage }) => {
    const { page, vueNodes } = comfyPage

    const result =
      await test.step('hold the first load open, then queue a second', async () =>
        await page.evaluate(
          async ([older, newer]) => {
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
              name: 'e2e.stallBeforeLoadGraph',
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
            noteWorkflow('older workflow'),
            noteWorkflow('newer workflow')
          ] as const
        ))

    expect(result).toEqual({
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

  test('a nested load from a lifecycle hook is refused instead of hanging the queue', async ({
    comfyPage
  }) => {
    const { page, vueNodes } = comfyPage

    const result = await page.evaluate(async (nested) => {
      let nestedOutcome = 'not attempted'
      let attempted = false
      window.app!.registerExtension({
        name: 'e2e.nestedLoadAfterAwait',
        beforeLoadGraph: async (app) => {
          if (attempted) return
          attempted = true
          await Promise.resolve()
          const outcome = await app.loadGraphData(nested)
          nestedOutcome = outcome === false ? 'refused' : 'resolved'
        }
      })

      await window.app!.loadGraphData(nested)
      return { nestedOutcome }
    }, noteWorkflow('nested workflow'))
    await comfyPage.workflow.loadGraphData(noteWorkflow('next workflow'))

    expect(result.nestedOutcome).toBe('refused')

    await expect(vueNodes.nodes).toHaveCount(1)
    await expect(vueNodes.getNodeByTitle('next workflow').first()).toBeVisible()
  })
})
