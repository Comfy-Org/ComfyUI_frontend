import { expect } from '@playwright/test'

import { queuedExecutionFixture as wstest } from '@e2e/fixtures/queuedExecutionFixture'
import { TestIds } from '@e2e/fixtures/selectors'
import { VueNodeFixture } from '@e2e/fixtures/utils/vueNodeFixtures'

wstest.describe('Docked actionbar run progress bar', { tag: ['@ui'] }, () => {
  wstest.use({
    initialSettings: {
      'Comfy.Queue.QPOV2': true
    }
  })

  wstest(
    'stays flush with the actionbar bottom while a job runs',
    async ({ comfyPage, queuedExecution }) => {
      const job = await queuedExecution.capture(() =>
        comfyPage.runButton.click()
      )
      job.start()
      job.progress('3', 13, 20)

      await expect(comfyPage.actionbar.inlineProgressNodeFill).toBeVisible()
      await comfyPage.actionbar.expectInlineProgressFlushWithCardBottom()
      await comfyPage.actionbar.expectInlineProgressClearOfControls()
    }
  )

  wstest(
    'grows with reported progress and clears when the job ends',
    async ({ comfyPage, queuedExecution }) => {
      const job = await queuedExecution.capture(() =>
        comfyPage.runButton.click()
      )
      job.start()
      job.progress('3', 5, 20)

      await comfyPage.actionbar.expectInlineProgressFilledFraction(0.25)

      job.progress('3', 18, 20)
      await comfyPage.actionbar.expectInlineProgressFilledFraction(0.9)
      await comfyPage.actionbar.expectInlineProgressFlushWithCardBottom()

      job.finish()
      await expect(comfyPage.actionbar.inlineProgress).toBeHidden()
    }
  )

  wstest(
    'keeps visible progress through concurrent background frames and completion',
    async ({ comfyPage, queuedExecution }) => {
      const topbar = comfyPage.menu.topbar
      const { runButton } = comfyPage

      const visibleJob = await queuedExecution.capture(() => runButton.click())
      await topbar.newWorkflowButton.click()
      await comfyPage.workflow.waitForWorkflowIdle()
      const backgroundJob = await queuedExecution.capture(() =>
        runButton.click()
      )
      await topbar.getTab(0).click()
      await comfyPage.workflow.waitForWorkflowIdle()

      visibleJob.start()
      backgroundJob.start()
      visibleJob.progress('3', 5, 20)
      await comfyPage.actionbar.expectInlineProgressFilledFraction(0.25)

      visibleJob.progress('3', 15, 20)
      backgroundJob.progress('3', 18, 20)
      await comfyPage.actionbar.expectInlineProgressFilledFraction(0.75)

      visibleJob.progress('3', 10, 20)
      backgroundJob.finish()
      await comfyPage.actionbar.expectInlineProgressFilledFraction(0.5)
    }
  )
})

wstest.describe('Queue progress overlay', { tag: ['@ui'] }, () => {
  wstest.use({
    initialSettings: {
      'Comfy.Queue.QPOV2': false
    }
  })

  wstest(
    'updates visual progress without changing layout width',
    async ({ comfyPage, queuedExecution }) => {
      const job = await queuedExecution.capture(() =>
        comfyPage.runButton.click()
      )
      job.start()
      job.progress('3', 5, 20)

      const { progressNodeFill } = comfyPage.queuePanel
      await expect(progressNodeFill).toBeVisible()
      await expect
        .poll(() =>
          progressNodeFill.evaluate(
            (element) =>
              element.getBoundingClientRect().width /
              (element as HTMLElement).offsetWidth
          )
        )
        .toBeCloseTo(0.25, 1)

      const initialLayoutWidth = await progressNodeFill.evaluate(
        (element) => (element as HTMLElement).offsetWidth
      )

      const animationStates = await progressNodeFill.evaluate((element) =>
        element.getAnimations().map((animation) => animation.playState)
      )
      expect(animationStates).toEqual(['paused'])

      job.progress('3', 18, 20)
      await expect
        .poll(() =>
          progressNodeFill.evaluate(
            (element) =>
              element.getBoundingClientRect().width /
              (element as HTMLElement).offsetWidth
          )
        )
        .toBeCloseTo(0.9, 1)

      await expect
        .poll(() =>
          progressNodeFill.evaluate(
            (element) => (element as HTMLElement).offsetWidth
          )
        )
        .toBe(initialLayoutWidth)
    }
  )
})

wstest.describe('Node progress bar', { tag: ['@ui', '@vue-nodes'] }, () => {
  wstest(
    'fills the track in proportion to the node progress, expanded and collapsed',
    async ({ comfyPage, queuedExecution }) => {
      const nodeId = await comfyPage.page.evaluate(() =>
        String(window.app!.graph.nodes[0].id)
      )
      const job = await queuedExecution.capture(() =>
        comfyPage.runButton.click()
      )
      job.start()
      job.progress(nodeId, 5, 20)

      const node = comfyPage.vueNodes.getNodeLocator(nodeId)
      const vueNode = new VueNodeFixture(node)
      const fill = node.getByTestId(TestIds.node.progressFill)
      await expect(fill).toBeVisible()

      const trackPlacement = async () => {
        const [nodeBox, headerBox, trackBox] = await Promise.all(
          [node, vueNode.header, fill.locator('..')].map((locator) =>
            locator.boundingBox()
          )
        )
        if (!nodeBox || !headerBox || !trackBox) return null
        return {
          left: Math.round(trackBox.x - nodeBox.x),
          widthBeyondNode: Math.round(trackBox.width - nodeBox.width),
          centerBelowHeader: Math.round(
            trackBox.y + trackBox.height / 2 - headerBox.y - headerBox.height
          )
        }
      }
      await expect
        .poll(trackPlacement)
        .toEqual({ left: 0, widthBeyondNode: 0, centerBelowHeader: 0 })

      const filledFraction = () =>
        fill.evaluate((element) => {
          const track = element.parentElement!.getBoundingClientRect()
          return (
            (element.getBoundingClientRect().right - track.left) / track.width
          )
        })
      await expect.poll(filledFraction).toBeCloseTo(0.25, 2)

      job.progress(nodeId, 18, 20)
      await expect.poll(filledFraction).toBeCloseTo(0.9, 2)

      job.progress(nodeId, 25, 20)
      await expect.poll(filledFraction).toBeCloseTo(1, 2)

      await vueNode.toggleCollapse()
      await expect
        .poll(trackPlacement)
        .toEqual({ left: 16, widthBeyondNode: 0, centerBelowHeader: 1 })

      job.progress(nodeId, 10, 20)
      await expect.poll(filledFraction).toBeCloseTo(0.5, 2)
    }
  )
})
