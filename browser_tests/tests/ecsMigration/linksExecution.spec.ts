import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import {
  expectNoVisibleErrors,
  trackVisibleErrors
} from '@e2e/fixtures/utils/errorSurfaces'

import type { ComfyApiWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
import { zComfyApiWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'

function getQueuedPrompt(body: unknown): ComfyApiWorkflow {
  if (typeof body !== 'object' || body === null || !('prompt' in body)) {
    throw new Error('Expected /api/prompt body to contain a prompt object')
  }
  return zComfyApiWorkflow.parse(body.prompt)
}

test.describe(
  'ECS migration: links, execution modes and regression sanity',
  { tag: ['@canvas', '@workflow'] },
  () => {
    test.use({
      initialSettings: {
        'Comfy.UseNewMenu': 'Disabled',
        'Comfy.Canvas.MouseWheelScroll': 'zoom',
        'Comfy.Canvas.LeftMouseClickBehavior': 'select'
      }
    })

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.canvasOps.resetView()
    })

    test('muting a middle node excludes it from the API prompt before queueing', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('default')
      const node = await comfyPage.nodeOps.getNodeRefById(3)
      await node.click('title')
      await comfyPage.keyboard.press('Control+KeyM')

      await expect.poll(() => node.getProperty<number>('mode')).toBe(2)

      let queuedPrompt: Record<string, unknown> | undefined
      const execution = new ExecutionHelper(comfyPage)
      await expect(
        execution.run({
          onPromptRequest: (body) => {
            queuedPrompt = getQueuedPrompt(body)
          }
        })
      ).resolves.toMatch(/^test-job-/)

      expect(queuedPrompt).toBeDefined()
      expect(queuedPrompt).not.toHaveProperty('3')
      expect(queuedPrompt?.['9']).toMatchObject({
        class_type: 'SaveImage',
        inputs: { images: ['8', 0] }
      })
    })

    test('bypassing a middle node preserves downstream API links before queueing', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('default')
      const node = await comfyPage.nodeOps.getNodeRefById(3)
      await node.click('title')
      await comfyPage.keyboard.press('Control+KeyB')

      await expect.poll(() => node.getProperty<number>('mode')).toBe(4)

      let queuedPrompt: ComfyApiWorkflow | undefined
      const execution = new ExecutionHelper(comfyPage)
      await expect(
        execution.run({
          onPromptRequest: (body) => {
            queuedPrompt = getQueuedPrompt(body)
          }
        })
      ).resolves.toMatch(/^test-job-/)

      expect(queuedPrompt).toBeDefined()
      expect(queuedPrompt).not.toHaveProperty('3')
      const samples = queuedPrompt?.['8']?.inputs.samples
      expect(Array.isArray(samples)).toBe(true)
      expect(samples).toEqual(['5', 0])
    })

    test('places a node from canvas search at the double-click position', async ({
      comfyPage
    }) => {
      await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
      await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(0)
      await comfyPage.searchBoxV2.ensureV2Search()
      const clickPosition = { x: 200, y: 200 }
      await comfyPage.searchBoxV2.addNode('KSampler', {
        position: clickPosition
      })

      await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(1)
      const placement = await comfyPage.page.evaluate(() => {
        const node = window.app!.graph.nodes.find(
          ({ type }) => type === 'KSampler'
        )
        return {
          graphMouse: window.app!.canvas.graph_mouse,
          position: node?.pos
        }
      })
      expect(placement.position?.[0]).toBeCloseTo(placement.graphMouse[0] - 135)
      expect(placement.position?.[1]).toBeCloseTo(placement.graphMouse[1] + 10)
    })

    test('pans, zooms and box-selects the expected nodes', async ({
      comfyPage,
      comfyMouse
    }) => {
      await comfyPage.workflow.loadWorkflow('default')
      const checkpoint = await comfyPage.nodeOps.getNodeRefById(4)
      const offsetBefore = await comfyPage.canvasOps.getOffset()
      const scaleBefore = await comfyPage.canvasOps.getScale()

      await comfyMouse.middleDragFromCenter(
        comfyPage.canvas,
        { x: 100, y: 80 },
        { steps: 10 }
      )
      await expect
        .poll(() => comfyPage.canvasOps.getOffset())
        .not.toEqual(offsetBefore)

      await comfyPage.page.mouse.move(400, 400)
      await comfyPage.page.mouse.wheel(0, -120)
      await comfyPage.nextFrame()
      await expect
        .poll(() => comfyPage.canvasOps.getScale())
        .not.toBe(scaleBefore)

      await comfyPage.canvasOps.resetView()
      const position = await checkpoint.getPosition()
      const from = await comfyPage.canvasOps.toAbsolute({
        x: position.x - 20,
        y: position.y - 20
      })
      const to = await comfyPage.canvasOps.toAbsolute({
        x: position.x + 340,
        y: position.y + 160
      })
      await comfyPage.canvasOps.dragAndDrop(from, to)
      await expect
        .poll(() => comfyPage.nodeOps.getSelectedNodeIds())
        .toEqual(['4'])
    })

    test('shows no error toast after loading, queueing and switching workflows', async ({
      comfyPage
    }) => {
      await trackVisibleErrors(comfyPage.page)
      await comfyPage.workflow.loadWorkflow('default')
      const execution = new ExecutionHelper(comfyPage)
      await execution.run()
      await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
      await comfyPage.workflow.waitForActiveWorkflow()
      await comfyPage.nextFrame()

      await expectNoVisibleErrors(
        comfyPage.page,
        'after loading, queueing and switching workflows'
      )
    })
  }
)
