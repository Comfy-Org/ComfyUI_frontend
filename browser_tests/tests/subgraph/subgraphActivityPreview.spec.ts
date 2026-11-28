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

function liveFramesDrawnOnCanvas(comfyPage: ComfyPage) {
  return comfyPage.page.evaluate((id) => {
    const app = window.app!
    const node = app.graph.getNodeById(id)!
    const element = app.canvas.canvas
    const scale = element.width / element.getBoundingClientRect().width
    const [x, top] = app.canvas.ds
      .convertOffsetToCanvas([node.pos[0] + node.size[0] / 2, node.pos[1]])
      .map((value) => Math.round(value * scale))
    const [, bottom] = app.canvas.ds
      .convertOffsetToCanvas([node.pos[0], node.pos[1] + node.size[1]])
      .map((value) => Math.round(value * scale))
    const column = element
      .getContext('2d')!
      .getImageData(x, top, 1, bottom - top).data
    let frames = 0
    let insideFrame = false
    for (let offset = 0; offset < column.length; offset += 4) {
      const red =
        column[offset] - Math.max(column[offset + 1], column[offset + 2]) > 100
      if (red && !insideFrame) frames++
      insideFrame = red
    }
    return frames
  }, toNodeId(HOST_ID))
}

test.describe(
  'Subgraph node live preview of the work inside it',
  { tag: ['@subgraph'] },
  () => {
    test.describe('in a workflow whose subgraph exposes no preview', () => {
      test.beforeEach(async ({ comfyPage }) => {
        await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph', {
          nodes: {
            [HOST_ID]: {
              properties: { previewExposures: [] },
              size: [320, 300]
            }
          }
        })
      })

      test(
        'While a subgraph runs, its node shows what is running inside, and the node keeps its size as the preview comes and goes',
        { tag: ['@vue-nodes'] },
        async ({ comfyPage, getWebSocket }) => {
          const host = comfyPage.vueNodes.getNodeLocator(HOST_ID)
          const liveFrame = host.getByRole('img', {
            name: 'Live sampling preview'
          })
          const execution = new ExecutionHelper(comfyPage, await getWebSocket())
          const layoutBefore = await hostLayoutSize(comfyPage)
          const boxBefore = await host.boundingBox()

          const firstRun = await execution.run()

          await test.step('a frame arrives from inside', async () => {
            execution.latentPreview(firstRun, INTERIOR_SAMPLER)
            await expect(liveFrame).toBeVisible()
            expect(await host.boundingBox()).toEqual(boxBefore)
            expect(await hostLayoutSize(comfyPage)).toEqual(layoutBefore)
          })

          await test.step('the frame goes away when the inner node runs again', async () => {
            execution.executionSuccess(firstRun)
            await expect(liveFrame).toBeVisible()
            execution.nodeRunning(await execution.run(), INTERIOR_SAMPLER, 0, 1)
            await expect(liveFrame).toBeHidden()
            expect(await host.boundingBox()).toEqual(boxBefore)
            expect(await hostLayoutSize(comfyPage)).toEqual(layoutBefore)
          })
        }
      )

      test(
        'Two nodes previewing in parallel inside one subgraph both show, without the node resizing',
        { tag: ['@vue-nodes'] },
        async ({ comfyPage, getWebSocket }) => {
          const host = comfyPage.vueNodes.getNodeLocator(HOST_ID)
          const liveFrames = host.getByRole('img', {
            name: 'Live sampling preview'
          })
          const execution = new ExecutionHelper(comfyPage, await getWebSocket())
          const boxBefore = await host.boundingBox()

          const run = await execution.run()
          execution.latentPreview(run, INTERIOR_SAMPLER)
          execution.latentPreview(run, INTERIOR_ENCODER)

          await expect(liveFrames).toHaveCount(2)
          expect(await host.boundingBox()).toEqual(boxBefore)
        }
      )

      test('While a subgraph runs, its canvas node draws what is running inside, and the node keeps its size as the preview comes and goes', async ({
        comfyPage,
        getWebSocket
      }) => {
        const execution = new ExecutionHelper(comfyPage, await getWebSocket())
        const layoutBefore = await hostLayoutSize(comfyPage)
        await expect.poll(() => liveFramesDrawnOnCanvas(comfyPage)).toBe(0)

        const firstRun = await execution.run()

        await test.step('a frame arrives from inside', async () => {
          execution.latentPreview(firstRun, INTERIOR_SAMPLER)
          execution.nodeRunning(firstRun, INTERIOR_SAMPLER, 1, 10)
          await expect.poll(() => liveFramesDrawnOnCanvas(comfyPage)).toBe(1)
          expect(await hostLayoutSize(comfyPage)).toEqual(layoutBefore)
        })

        await test.step('the frame goes away when the inner node runs again', async () => {
          execution.executionSuccess(firstRun)
          const secondRun = await execution.run()
          execution.nodeRunning(secondRun, INTERIOR_SAMPLER, 0, 2)
          await expect
            .poll(() => {
              execution.progress(secondRun, INTERIOR_SAMPLER, 1, 2)
              return liveFramesDrawnOnCanvas(comfyPage)
            })
            .toBe(0)
          expect(await hostLayoutSize(comfyPage)).toEqual(layoutBefore)
        })
      })

      test('Two nodes previewing in parallel inside one subgraph are both drawn on the canvas node, without it resizing', async ({
        comfyPage,
        getWebSocket
      }) => {
        const execution = new ExecutionHelper(comfyPage, await getWebSocket())
        const layoutBefore = await hostLayoutSize(comfyPage)

        const run = await execution.run()
        execution.latentPreview(run, INTERIOR_SAMPLER)
        execution.latentPreview(run, INTERIOR_ENCODER)

        await expect.poll(() => liveFramesDrawnOnCanvas(comfyPage)).toBe(2)
        expect(await hostLayoutSize(comfyPage)).toEqual(layoutBefore)
      })
    })

    test(
      'When an exposed preview already shows a live frame, the subgraph node does not show it a second time',
      { tag: ['@vue-nodes'] },
      async ({ comfyPage, getWebSocket }) => {
        await comfyPage.workflow.loadWorkflow(
          'subgraphs/shared-definition-two-hosts-save-image'
        )
        const execution = new ExecutionHelper(comfyPage, await getWebSocket())
        const liveFramesIn = (hostId: string) =>
          comfyPage.vueNodes
            .getNodeLocator(hostId)
            .getByRole('img', { name: 'Live sampling preview' })

        execution.latentPreview(await execution.run(), '5:10')

        await expect(liveFramesIn('5')).toHaveCount(1)
        await expect(liveFramesIn('6')).toHaveCount(0)
      }
    )
  }
)
