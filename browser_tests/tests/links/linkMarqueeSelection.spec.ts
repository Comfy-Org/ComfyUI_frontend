import type { Page } from '@playwright/test'

import type { Point } from '@/lib/litegraph/src/interfaces'

import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

const CONDITIONING_INPUTS = ['positive', 'negative']

async function conditioningLinks(page: Page) {
  const handle = await page.waitForFunction((inputNames) => {
    const app = window.app!
    const sampler = app.graph.nodes.find((node) => node.type === 'KSampler')
    if (!sampler) return null
    const links = inputNames.map((name) => {
      const index = sampler.inputs.findIndex((slot) => slot.name === name)
      const linkId = sampler.inputs[index]?.link
      const link = linkId != null ? app.graph.getLink(linkId) : null
      if (!link?.path) return null
      return {
        id: link.id,
        end: app.canvasPosToClientPos(sampler.getInputPos(index))
      }
    })
    return links.every((link) => link !== null) ? links : null
  }, CONDITIONING_INPUTS)
  const links = await handle.jsonValue()
  if (!links) throw new Error('Rendered conditioning links were not found')
  return links.map((link) => ({ id: String(link.id), end: link.end }))
}

async function marqueeBeforeInputs(comfyPage: ComfyPage, ends: Point[]) {
  const x = Math.min(...ends.map(([endX]) => endX))
  const ys = ends.map(([, y]) => y)
  await comfyPage.canvasOps.dragAndDrop(
    { x: x - 60, y: Math.min(...ys) - 6 },
    { x: x - 25, y: Math.max(...ys) + 6 }
  )
}

async function moveSamplerAway(comfyPage: ComfyPage) {
  await comfyPage.page.evaluate(() => {
    const app = window.app!
    const sampler = app.graph.nodes.find((node) => node.type === 'KSampler')
    if (!sampler) throw new Error('KSampler not found')
    sampler.pos = [sampler.pos[0] + 400, sampler.pos[1]]
    app.canvas.setDirty(true, true)
  })
  await comfyPage.nextFrame()
}

async function graphLinkIds(page: Page) {
  return page.evaluate(() =>
    [...window.app!.graph.links.keys()].map((id) => String(id))
  )
}

test.describe('Marquee link selection', { tag: '@canvas' }, () => {
  test.use({
    initialSettings: {
      'Comfy.Canvas.SelectionToolbox': true,
      'Comfy.Canvas.NavigationMode': 'standard'
    }
  })

  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('default')
    await moveSamplerAway(comfyPage)
  })

  test('hides, then deletes, the links under an empty marquee', async ({
    comfyPage
  }) => {
    const links = await conditioningLinks(comfyPage.page)
    const linkIds = links.map((link) => link.id)
    const ends = links.map((link) => link.end)

    await test.step('Hide both links from the toolbox', async () => {
      await marqueeBeforeInputs(comfyPage, ends)
      await comfyPage.selectionToolbox
        .getByTestId(TestIds.selectionToolbox.hideLinks)
        .click()

      await expect
        .poll(
          async () =>
            (await comfyPage.workflow.getExportedWorkflow()).extra
              ?.linkPresentation
        )
        .toEqual(
          Object.fromEntries(linkIds.map((id) => [id, { hidden: true }]))
        )
      await expect(comfyPage.selectionToolbox).toBeHidden()
    })

    await test.step('Show the links again with undo', async () => {
      await comfyPage.keyboard.undo()
      await expect
        .poll(
          async () =>
            (await comfyPage.workflow.getExportedWorkflow()).extra
              ?.linkPresentation ?? {}
        )
        .toEqual({})
    })

    const allLinkIds = await graphLinkIds(comfyPage.page)
    const otherLinkIds = allLinkIds.filter((id) => !linkIds.includes(id))

    await test.step('Delete both links from the toolbox', async () => {
      await marqueeBeforeInputs(comfyPage, ends)
      await comfyPage.selectionToolbox
        .getByTestId(TestIds.selectionToolbox.deleteLinks)
        .click()

      await expect
        .poll(() => graphLinkIds(comfyPage.page))
        .toEqual(otherLinkIds)
    })

    await test.step('Restore both links with one undo', async () => {
      await comfyPage.keyboard.undo()
      await expect
        .poll(async () => (await graphLinkIds(comfyPage.page)).sort())
        .toEqual([...allLinkIds].sort())
    })

    await test.step('Delete both links with the Delete key', async () => {
      await marqueeBeforeInputs(comfyPage, ends)
      await expect(
        comfyPage.selectionToolbox.getByTestId(
          TestIds.selectionToolbox.deleteLinks
        )
      ).toBeVisible()
      await comfyPage.keyboard.delete()

      await expect
        .poll(() => graphLinkIds(comfyPage.page))
        .toEqual(otherLinkIds)
    })
  })
})
