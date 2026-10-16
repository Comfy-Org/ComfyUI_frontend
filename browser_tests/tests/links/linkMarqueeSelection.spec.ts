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
    const drawn = inputNames.flatMap((name) => {
      const input = sampler.inputs.find((slot) => slot.name === name)
      const link = input?.link != null ? app.graph.getLink(input.link) : null
      return link?.path ? [{ id: link.id, path: link.path }] : []
    })
    if (drawn.length !== inputNames.length) return null

    const right = sampler.pos[0] - 4
    const top = Math.min(...app.graph.nodes.map((node) => node.pos[1]))
    const bottom = Math.max(
      ...app.graph.nodes.map((node) => node.pos[1] + node.size[1])
    )
    const blockingEdges = app.graph.nodes
      .filter((node) => node !== sampler)
      .map((node) => node.boundingRect)
      .filter(([x, , width]) => x + width < right)
      .map(([x, , width]) => x + width)
    const left = Math.max(right - 200, ...blockingEdges)

    const probe = new OffscreenCanvas(1, 1).getContext('2d')!
    probe.lineWidth = 2
    const crossings = (path: Path2D, x: number) => {
      const ys: number[] = []
      for (let y = top; y <= bottom; y++)
        if (probe.isPointInStroke(path, x, y)) ys.push(y)
      return ys
    }
    const conditioningIds = new Set(drawn.map((link) => link.id))
    const otherPaths = [...app.graph.links.values()].flatMap((link) =>
      !conditioningIds.has(link.id) && link.path ? [link.path] : []
    )

    for (let x = right - 2; x > left + 2; x -= 2) {
      const perLink = drawn.map((link) => crossings(link.path, x))
      if (perLink.some((ys) => ys.length === 0)) continue
      const targetYs = perLink.flat()
      const bandTop = Math.min(...targetYs) - 3
      const bandBottom = Math.max(...targetYs) + 3
      const blocked = otherPaths.some((path) =>
        [x - 2, x, x + 2].some((column) =>
          crossings(path, column).some((y) => y >= bandTop && y <= bandBottom)
        )
      )
      if (blocked) continue
      return {
        ids: drawn.map((link) => String(link.id)),
        from: app.canvasPosToClientPos([x - 2, bandTop]),
        to: app.canvasPosToClientPos([x + 2, bandBottom])
      }
    }
    throw new Error('No x isolates the conditioning links')
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

test.describe('Socket click link selection', { tag: '@canvas' }, () => {
  test.use({ initialSettings: { 'Comfy.Canvas.SelectionToolbox': true } })

  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('default')
  })

  test('clicking an output hides and shows its links, and dragging it still connects', async ({
    comfyPage
  }) => {
    const [loader] = await comfyPage.nodeOps.getNodeRefsByType(
      'CheckpointLoaderSimple'
    )
    const [encoder] =
      await comfyPage.nodeOps.getNodeRefsByType('CLIPTextEncode')
    const clipOutput = await loader.getOutput(1)
    const encoderInput = await encoder.getInput(0)
    const inputLinkId = () =>
      comfyPage.page.evaluate(
        (id) => window.app!.graph.getNodeById(id)?.inputs[0].link ?? null,
        encoder.id
      )
    const clipLinkIds = await comfyPage.page.evaluate(
      (id) =>
        (window.app!.graph.getNodeById(id)?.outputs[1].links ?? []).map(String),
      loader.id
    )
    expect(clipLinkIds).toHaveLength(2)

    await test.step('Hide both links from the toolbox', async () => {
      const position = await clipOutput.getPosition()
      await comfyPage.page.mouse.click(position.x, position.y)
      await comfyPage.selectionToolbox
        .getByTestId(TestIds.selectionToolbox.hideLinks)
        .click()

      await expect
        .poll(
          async () =>
            (await comfyPage.workflow.getExportedWorkflow()).extra
              ?.linkPresentation
        )
        .toMatchObject(
          Object.fromEntries(clipLinkIds.map((id) => [id, { hidden: true }]))
        )
    })

    await test.step('Show both hidden links from the toolbox', async () => {
      const position = await clipOutput.getPosition()
      await comfyPage.page.mouse.click(position.x, position.y)
      await expect(
        comfyPage.selectionToolbox.getByTestId(
          TestIds.selectionToolbox.hideLinks
        )
      ).toBeHidden()
      await comfyPage.selectionToolbox
        .getByTestId(TestIds.selectionToolbox.showLinks)
        .click()

      await expect
        .poll(
          async () =>
            (await comfyPage.workflow.getExportedWorkflow()).extra
              ?.linkPresentation ?? {}
        )
        .toEqual({})
    })

    await test.step('Drag from the same output to reconnect an input', async () => {
      const previousLinkId = await inputLinkId()
      await comfyPage.canvasOps.dragAndDrop(
        await clipOutput.getPosition(),
        await encoderInput.getPosition()
      )

      await expect.poll(inputLinkId).not.toBe(previousLinkId)
      await expect.poll(() => clipOutput.getLinkCount()).toBe(2)
    })
  })
})
