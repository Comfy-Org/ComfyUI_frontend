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
    const slots = inputNames.map((name) => {
      const index = sampler.inputs.findIndex((slot) => slot.name === name)
      const linkId = sampler.inputs[index]?.link
      const link = linkId != null ? app.graph.getLink(linkId) : null
      return link?.path
        ? { id: link.id, pos: sampler.getInputPos(index) }
        : null
    })
    if (!slots.every((slot) => slot !== null)) return null
    const top = Math.min(...slots.map(({ pos }) => pos[1])) - 6
    const bottom = Math.max(...slots.map(({ pos }) => pos[1])) + 6
    const right = sampler.pos[0] - 4
    const blockingEdges = app.graph.nodes
      .filter((node) => node !== sampler)
      .map((node) => node.boundingRect)
      .filter(
        ([x, y, width, height]) =>
          y < bottom && y + height > top && x + width < right
      )
      .map(([x, , width]) => x + width)
    const left = Math.max(right - 40, ...blockingEdges.map((x) => x + 4))
    if (left >= right)
      throw new Error('No empty canvas between the KSampler and its neighbour')
    return {
      ids: slots.map(({ id }) => String(id)),
      from: app.canvasPosToClientPos([left, top]),
      to: app.canvasPosToClientPos([right, bottom])
    }
  }, CONDITIONING_INPUTS)
  const links = await handle.jsonValue()
  if (!links) throw new Error('Rendered conditioning links were not found')
  return links
}

async function marqueeBeforeInputs(
  comfyPage: ComfyPage,
  { from, to }: { from: Point; to: Point }
) {
  await comfyPage.canvasOps.dragAndDrop(
    { x: from[0], y: from[1] },
    { x: to[0], y: to[1] }
  )
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
  })

  test('hides, then deletes, the links under an empty marquee', async ({
    comfyPage
  }) => {
    const { ids: linkIds, ...marquee } = await conditioningLinks(comfyPage.page)

    await test.step('Hide both links from the toolbox', async () => {
      await marqueeBeforeInputs(comfyPage, marquee)
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
      await marqueeBeforeInputs(comfyPage, marquee)
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
      await marqueeBeforeInputs(comfyPage, marquee)
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
