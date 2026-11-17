import { mergeTests } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  comfyExpect as expect,
  comfyPageFixture
} from '@e2e/fixtures/ComfyPage'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import { webSocketFixture } from '@e2e/fixtures/ws'
import { toNodeId } from '@comfyorg/graph-model/nodeId'

const test = mergeTests(comfyPageFixture, webSocketFixture)

const HOST_ID = '2'
const INTERIOR_SAMPLER = '2:1'
const INTERIOR_ENCODER = '2:3'

function hostLayoutSize(comfyPage: ComfyPage) {
  return comfyPage.page.evaluate(
    (id) => [...window.app!.graph.getNodeById(id)!.size],
    toNodeId(HOST_ID)
  )
}

function liveFrameRedness(comfyPage: ComfyPage) {
  return comfyPage.page.evaluate((id) => {
    const app = window.app!
    const node = app.graph.getNodeById(id)!
    const [x, y] = app.canvas.ds.convertOffsetToCanvas([
      node.pos[0] + node.size[0] / 2,
      node.pos[1] + node.size[1] - 60
    ])
    const element = app.canvas.canvas
    const scale = element.width / element.getBoundingClientRect().width
    const [red, green, blue] = element
      .getContext('2d')!
      .getImageData(Math.round(x * scale), Math.round(y * scale), 1, 1).data
    return red - Math.max(green, blue)
  }, toNodeId(HOST_ID))
}

test.describe(
  'Subgraph node live preview of activity inside it',
  { tag: ['@subgraph'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-sampler-without-exposures'
      )
    })

    test(
      'shows the frame in the Vue node without resizing it',
      { tag: ['@vue-nodes'] },
      async ({ comfyPage, getWebSocket }) => {
        const host = comfyPage.vueNodes.getNodeLocator(HOST_ID)
        const liveFrame = host.getByRole('img', {
          name: 'Live sampling preview'
        })
        const execution = new ExecutionHelper(comfyPage, await getWebSocket())
        const layoutBefore = await hostLayoutSize(comfyPage)
        const boxBefore = await host.boundingBox()

        await test.step('a frame arrives from inside', async () => {
          execution.latentPreview('first-run', INTERIOR_SAMPLER)
          await expect(liveFrame).toBeVisible()
          expect(await host.boundingBox()).toEqual(boxBefore)
          expect(await hostLayoutSize(comfyPage)).toEqual(layoutBefore)
        })

        await test.step('the frame goes away when the interior node runs again', async () => {
          execution.nodeRunning('second-run', INTERIOR_SAMPLER, 0, 1)
          await expect(liveFrame).toBeHidden()
          expect(await host.boundingBox()).toEqual(boxBefore)
          expect(await hostLayoutSize(comfyPage)).toEqual(layoutBefore)
        })
      }
    )

    test(
      'shows frames from two interior nodes at once without resizing it',
      { tag: ['@vue-nodes'] },
      async ({ comfyPage, getWebSocket }) => {
        const host = comfyPage.vueNodes.getNodeLocator(HOST_ID)
        const liveFrames = host.getByRole('img', {
          name: 'Live sampling preview'
        })
        const execution = new ExecutionHelper(comfyPage, await getWebSocket())
        const boxBefore = await host.boundingBox()

        execution.latentPreview('parallel-run', INTERIOR_SAMPLER)
        execution.latentPreview('parallel-run', INTERIOR_ENCODER)

        await expect(liveFrames).toHaveCount(2)
        expect(await host.boundingBox()).toEqual(boxBefore)
      }
    )

    test('draws the frame in the canvas node without resizing it', async ({
      comfyPage,
      getWebSocket
    }) => {
      const execution = new ExecutionHelper(comfyPage, await getWebSocket())
      const layoutBefore = await hostLayoutSize(comfyPage)
      await expect.poll(() => liveFrameRedness(comfyPage)).toBeLessThan(100)

      await test.step('a frame arrives from inside', async () => {
        execution.latentPreview('first-run', INTERIOR_SAMPLER)
        execution.nodeRunning('first-run', INTERIOR_SAMPLER, 1, 10)
        await expect
          .poll(() => liveFrameRedness(comfyPage))
          .toBeGreaterThan(100)
        expect(await hostLayoutSize(comfyPage)).toEqual(layoutBefore)
      })

      await test.step('the frame goes away when the interior node runs again', async () => {
        execution.nodeRunning('second-run', INTERIOR_SAMPLER, 0, 2)
        await expect
          .poll(() => {
            execution.progress('second-run', INTERIOR_SAMPLER, 1, 2)
            return liveFrameRedness(comfyPage)
          })
          .toBeLessThan(100)
        expect(await hostLayoutSize(comfyPage)).toEqual(layoutBefore)
      })
    })
  }
)
