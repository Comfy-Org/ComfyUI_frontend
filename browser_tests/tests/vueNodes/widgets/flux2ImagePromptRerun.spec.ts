import { mergeTests } from '@playwright/test'
import type { Locator, WebSocketRoute } from '@playwright/test'

import {
  comfyExpect as expect,
  comfyPageFixture
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import { webSocketFixture } from '@e2e/fixtures/ws'

/**
 * PM-1303 / PM-1310: Guard the Flux2ImageNode prompt and layout across
 * repeated generations, including transient progress and output previews.
 *
 * Execution is simulated the way the backend drives it: a real
 * `Comfy.QueuePrompt` through the UI, then the WS frames an API node emits
 * (`progress_text` status lines, an `executed` image, `execution_success`).
 */
const test = mergeTests(comfyPageFixture, webSocketFixture)

const NODE_TITLE = 'Flux.2 Image'
const PROMPT = 'a glorious spooky duck in a cathedral'
const RUNNING_STATUS = 'Status: Running\nTime elapsed: 3s (~117s remaining)'

/** Binary WS frame type 3 (`progress_text`): [u32 type][u32 idLen][id][text]. */
function progressTextFrame(nodeId: string, text: string): Buffer {
  const id = Buffer.from(nodeId, 'utf8')
  const body = Buffer.from(text, 'utf8')
  const frame = Buffer.alloc(8 + id.length + body.length)
  frame.writeUInt32BE(3, 0)
  frame.writeUInt32BE(id.length, 4)
  id.copy(frame, 8)
  body.copy(frame, 8 + id.length)
  return frame
}

function getNode(comfyPage: ComfyPage): Locator {
  return comfyPage.vueNodes.getNodeByTitle(NODE_TITLE)
}

function getPromptBox(comfyPage: ComfyPage): Locator {
  return getNode(comfyPage).getByRole('textbox', { name: 'prompt' })
}

/** One full generation of the node the way an API node runs it. */
async function runGeneration(
  comfyPage: ComfyPage,
  exec: ExecutionHelper,
  ws: WebSocketRoute,
  nodeId: string
) {
  const jobId = await exec.run()
  exec.executionStart(jobId)
  exec.executing(jobId, nodeId)
  exec.nodeRunning(jobId, nodeId, 0, 1)
  ws.send(progressTextFrame(nodeId, RUNNING_STATUS))
  exec.executed(jobId, nodeId, {
    images: [{ filename: 'example.png', subfolder: '', type: 'input' }]
  })
  exec.executing(jobId, null)
  exec.executionSuccess(jobId)
  exec.status(0)
  await expect(
    getNode(comfyPage).getByRole('img', { name: 'View image 1 of 1' })
  ).toBeVisible()
}

/** Prompt widget identity as the widget store and litegraph see it. */
function readPromptWidget(comfyPage: ComfyPage) {
  return comfyPage.page.evaluate(() => {
    const node = window.app!.graph.nodes.find(
      (n) => n.type === 'Flux2ImageNode'
    )
    if (!node) throw new Error('Flux2ImageNode is not on the graph')
    const root = document.getElementById('vue-app')
    if (!root) throw new Error('Vue app root is not mounted')
    const vueApp = (
      root as HTMLElement & {
        __vue_app__: {
          config: {
            globalProperties: { $pinia: { _s: Map<string, unknown> } }
          }
        }
      }
    ).__vue_app__
    const store = vueApp.config.globalProperties.$pinia._s.get(
      'widgetValue'
    ) as {
      getNodeWidgetIds: (graphId: string, nodeId: number | string) => string[]
      getWidget: (id: string) => { type: string; value: unknown } | undefined
    }
    const graphId = window.app!.rootGraph.id
    const promptId = `${graphId}:${node.id}:prompt`
    const progressTextId = `${graphId}:${node.id}:$$node-text-preview`
    return {
      nodeId: String(node.id),
      liteWidgetNames: (node.widgets ?? []).map((w) => w.name),
      liteWidgetType: node.widgets?.find((w) => w.name === 'prompt')?.type,
      storeOrderHasPrompt: store
        .getNodeWidgetIds(graphId, node.id)
        .includes(promptId),
      storeType: store.getWidget(promptId)?.type,
      storeValue: store.getWidget(promptId)?.value,
      storeHasProgressText: store.getWidget(progressTextId) !== undefined,
      autogrowInputs: node.inputs
        .map((input) => input.name)
        .filter((name) => name.startsWith('model.images.'))
    }
  })
}

test.describe(
  'Flux2ImageNode prompt across generations',
  { tag: ['@vue-nodes', '@widget', '@node'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('widgets/flux2_image_node')
      await getPromptBox(comfyPage).fill(PROMPT)
    })

    test('hypothesis A: prompt widget keeps its registered type through two generations', async ({
      comfyPage,
      getWebSocket
    }) => {
      const ws = await getWebSocket()
      const exec = new ExecutionHelper(comfyPage, ws)
      const before = await readPromptWidget(comfyPage)
      expect(before.storeType).toBe('customtext')

      await runGeneration(comfyPage, exec, ws, before.nodeId)
      await runGeneration(comfyPage, exec, ws, before.nodeId)

      const after = await readPromptWidget(comfyPage)
      expect(after).toMatchObject({
        storeType: 'customtext',
        liteWidgetType: 'customtext',
        storeValue: PROMPT
      })
    })

    test('hypothesis B: prompt stays in node.widgets and the widget order through two generations', async ({
      comfyPage,
      getWebSocket
    }) => {
      const ws = await getWebSocket()
      const exec = new ExecutionHelper(comfyPage, ws)
      const before = await readPromptWidget(comfyPage)

      await runGeneration(comfyPage, exec, ws, before.nodeId)
      await runGeneration(comfyPage, exec, ws, before.nodeId)

      const after = await readPromptWidget(comfyPage)
      expect(after.liteWidgetNames).toContain('prompt')
      expect(after.storeOrderHasPrompt).toBe(true)
      expect(after.autogrowInputs).toEqual(before.autogrowInputs)
    })

    test('completed generations remove progress text from the node and widget store', async ({
      comfyPage,
      getWebSocket
    }) => {
      const ws = await getWebSocket()
      const exec = new ExecutionHelper(comfyPage, ws)
      const { nodeId } = await readPromptWidget(comfyPage)

      await runGeneration(comfyPage, exec, ws, nodeId)

      expect(await readPromptWidget(comfyPage)).toMatchObject({
        liteWidgetNames: expect.not.arrayContaining(['$$node-text-preview']),
        storeHasProgressText: false
      })
    })

    test(
      'prompt text box is still visible after two generations',
      { tag: '@screenshot' },
      async ({ comfyPage, getWebSocket }) => {
        await comfyPage.page.setViewportSize({ width: 1280, height: 900 })
        const ws = await getWebSocket()
        const exec = new ExecutionHelper(comfyPage, ws)
        const { nodeId } = await readPromptWidget(comfyPage)
        const node = getNode(comfyPage)
        const promptBox = getPromptBox(comfyPage)
        await expect(promptBox).toBeVisible()
        await expect(node).toHaveScreenshot('flux2-prompt-before-runs.png', {
          maxDiffPixels: 10
        })

        await runGeneration(comfyPage, exec, ws, nodeId)
        await expect(promptBox).toBeVisible()
        await expect(node).toHaveScreenshot('flux2-prompt-after-run-1.png', {
          maxDiffPixels: 10
        })

        await runGeneration(comfyPage, exec, ws, nodeId)
        await expect(promptBox).toBeVisible()
        await expect(promptBox).toHaveValue(PROMPT)
        await expect(node).toHaveScreenshot('flux2-prompt-after-run-2.png', {
          maxDiffPixels: 10
        })
      }
    )

    test('hypothesis D: prompt text box keeps its height after two generations', async ({
      comfyPage,
      getWebSocket
    }) => {
      const ws = await getWebSocket()
      const exec = new ExecutionHelper(comfyPage, ws)
      const { nodeId } = await readPromptWidget(comfyPage)
      const promptBox = getPromptBox(comfyPage)
      const before = await promptBox.boundingBox()
      expect(before).not.toBeNull()

      await runGeneration(comfyPage, exec, ws, nodeId)
      await runGeneration(comfyPage, exec, ws, nodeId)

      await expect
        .poll(async () => (await promptBox.boundingBox())?.height)
        .toBeGreaterThanOrEqual(before!.height)
    })

    test('resized authored height survives removal and restoration of output previews', async ({
      comfyPage,
      getWebSocket
    }) => {
      await comfyPage.page.setViewportSize({ width: 1440, height: 1200 })
      const ws = await getWebSocket()
      const exec = new ExecutionHelper(comfyPage, ws)
      const { nodeId } = await readPromptWidget(comfyPage)
      const node = await comfyPage.vueNodes.getFixtureByTitle(NODE_TITLE)
      const savedSize = async () =>
        (await comfyPage.workflow.getExportedWorkflow()).nodes.find(
          (entry) => String(entry.id) === nodeId
        )?.size
      const initialSize = await savedSize()
      expect(initialSize).toBeDefined()

      const { resizedSize, expandedHeight, beforeResize } =
        await test.step('resize and persist the authored height', async () => {
          await runGeneration(comfyPage, exec, ws, nodeId)
          const beforeHeight = (await node.boundingBox())?.height
          expect(beforeHeight).toBeDefined()
          const beforeResize = Date.now()
          await node.resizeFromCorner('SE', 0, 83)
          await expect.poll(savedSize).not.toEqual(initialSize)
          await expect
            .poll(async () => (await node.boundingBox())?.height)
            .toBeCloseTo(beforeHeight! + 83, 0)
          const resizedSize = await savedSize()
          const expandedHeight = (await node.boundingBox())?.height
          expect(expandedHeight).toBeDefined()
          return { resizedSize, expandedHeight, beforeResize }
        })

      await test.step('reload and remove the output preview', async () => {
        await comfyPage.workflow.waitForDraftIndexUpdatedSince(beforeResize)
        await comfyPage.workflow.reloadAndWaitForApp()
        await expect(
          getNode(comfyPage).getByRole('img', { name: 'View image 1 of 1' })
        ).toBeHidden()
        await expect
          .poll(async () => (await node.boundingBox())?.height)
          .toBeLessThan(expandedHeight!)
        expect(await savedSize()).toEqual(resizedSize)
      })

      await test.step('restore the output preview', async () => {
        const restoredWs = await getWebSocket()
        await runGeneration(
          comfyPage,
          new ExecutionHelper(comfyPage, restoredWs),
          restoredWs,
          nodeId
        )
        await expect
          .poll(async () => (await node.boundingBox())?.height)
          .toBeCloseTo(expandedHeight!, 0)
        expect(await savedSize()).toEqual(resizedSize)
        await expect(getPromptBox(comfyPage)).toHaveValue(PROMPT)
      })
    })
  }
)
