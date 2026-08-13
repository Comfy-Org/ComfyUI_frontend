import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { validateComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'

test.use({
  initialSettings: { 'Comfy.UseNewMenu': 'Disabled' }
})

test.describe('Hidden link badges', { tag: ['@canvas'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('reroute/native_reroute')
  })

  test('hides, reveals, and restores a link from canvas gestures', async ({
    comfyPage
  }) => {
    const linkPointHandle = await comfyPage.page.waitForFunction(() => {
      const link = window.app!.graph!.links.values().next().value
      const pos = link?._pos
      return pos ? { x: pos[0], y: pos[1] } : null
    })
    const linkPoint = await linkPointHandle.jsonValue()
    if (!linkPoint) throw new Error('Rendered link midpoint was not found')
    await comfyPage.page.mouse.click(linkPoint.x, linkPoint.y, {
      button: 'right'
    })
    await expect(comfyPage.contextMenu.litegraphContextMenu).toBeVisible()
    await comfyPage.contextMenu.clickLitegraphMenuItem('Hide Link')
    await comfyPage.contextMenu.waitForHidden()
    await comfyPage.nextFrame()

    await expect
      .poll(() =>
        comfyPage.page.evaluate(() => {
          const canvas = window.app!.canvas
          const link = window.app!.graph!.links.values().next().value
          return {
            hidden: link?.hidden,
            curveRendered: link ? canvas.renderedPaths.has(link) : null,
            badgeCount: canvas.linkBadgeFrameState.hitAreas.length
          }
        })
      )
      .toEqual({ hidden: true, curveRendered: false, badgeCount: 2 })

    const badgeCenter = await comfyPage.page.evaluate(() => {
      const badge = window.app!.canvas.linkBadgeFrameState.hitAreas[0]
      return badge
        ? {
            x: badge.x + badge.width / 2,
            y: badge.y + badge.height / 2
          }
        : null
    })
    if (!badgeCenter) throw new Error('Hidden link badge was not found')
    await comfyPage.page.mouse.move(badgeCenter.x, badgeCenter.y)
    await comfyPage.nextFrame()

    await expect
      .poll(() =>
        comfyPage.page.evaluate(() => {
          const link = window.app!.graph!.links.values().next().value
          return {
            hidden: link?.hidden,
            curveRendered: link
              ? window.app!.canvas.renderedPaths.has(link)
              : null
          }
        })
      )
      .toEqual({ hidden: true, curveRendered: true })

    await comfyPage.page.mouse.click(badgeCenter.x, badgeCenter.y, {
      button: 'right'
    })
    await expect(comfyPage.contextMenu.litegraphContextMenu).toBeVisible()
    await comfyPage.contextMenu.clickLitegraphMenuItem('Show Link')
    await comfyPage.contextMenu.waitForHidden()
    await comfyPage.nextFrame()

    await expect
      .poll(() =>
        comfyPage.page.evaluate(() => {
          const canvas = window.app!.canvas
          const link = window.app!.graph!.links.values().next().value
          return {
            hidden: link?.hidden,
            curveRendered: link ? canvas.renderedPaths.has(link) : null,
            badgeCount: canvas.linkBadgeFrameState.hitAreas.length
          }
        })
      )
      .toEqual({ hidden: false, curveRendered: true, badgeCount: 0 })
  })

  test('persists hidden state through a serialize and load round-trip', async ({
    comfyPage
  }) => {
    const linkPointHandle = await comfyPage.page.waitForFunction(() => {
      const link = window.app!.graph!.links.values().next().value
      const pos = link?._pos
      return pos ? { x: pos[0], y: pos[1] } : null
    })
    const linkPoint = await linkPointHandle.jsonValue()
    if (!linkPoint) throw new Error('Rendered link midpoint was not found')
    await comfyPage.page.mouse.click(linkPoint.x, linkPoint.y, {
      button: 'right'
    })
    await expect(comfyPage.contextMenu.litegraphContextMenu).toBeVisible()
    await comfyPage.contextMenu.clickLitegraphMenuItem('Hide Link')
    await comfyPage.contextMenu.waitForHidden()
    await comfyPage.nextFrame()

    const { serialized, linkId } = await comfyPage.page.evaluate(() => {
      const link = window.app!.graph!.links.values().next().value
      if (!link) throw new Error('Workflow link was not found')
      return {
        serialized: window.app!.graph!.serialize(),
        linkId: String(link.id)
      }
    })
    expect(serialized.extra?.linkVisibility).toEqual({
      [linkId]: { hidden: true }
    })

    const validated = await validateComfyWorkflow(serialized)
    if (!validated) throw new Error('Serialized workflow failed validation')
    await comfyPage.workflow.loadGraphData(validated)

    await expect
      .poll(() =>
        comfyPage.page.evaluate(() => {
          const canvas = window.app!.canvas
          const link = window.app!.graph!.links.values().next().value
          return {
            hidden: link?.hidden,
            curveRendered: link ? canvas.renderedPaths.has(link) : null,
            badgeCount: canvas.linkBadgeFrameState.hitAreas.length
          }
        })
      )
      .toEqual({ hidden: true, curveRendered: false, badgeCount: 2 })
  })
})

test.describe(
  'Hidden link Vue slot reveal',
  { tag: ['@canvas', '@vue-nodes'] },
  () => {
    test('reveals the link while connected input and output slots are hovered', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('reroute/native_reroute')

      const sourceNode =
        await comfyPage.vueNodes.getFixtureByTitle('Load Checkpoint')
      const targetNode =
        await comfyPage.vueNodes.getFixtureByTitle('VAE Decode')
      const inputSlot = targetNode.getSlot('vae')
      const outputSlot = sourceNode.getSlot('VAE')
      await expect(inputSlot).toBeVisible()
      await expect(outputSlot).toBeVisible()

      await comfyPage.page.evaluate(() => {
        const link = window.app!.graph!.links.values().next().value
        if (!link) throw new Error('Workflow link was not found')
        link.hidden = true
        window.app!.canvas.setDirty(false, true)
      })
      await comfyPage.nextFrame()
      await expect
        .poll(() =>
          comfyPage.page.evaluate(() => {
            const link = window.app!.graph!.links.values().next().value
            return link
              ? {
                  hidden: link.hidden,
                  curveRendered: window.app!.canvas.renderedPaths.has(link)
                }
              : null
          })
        )
        .toEqual({ hidden: true, curveRendered: false })

      const inputBounds = await inputSlot.boundingBox()
      if (!inputBounds) throw new Error('Input slot has no bounding box')
      await comfyPage.page.mouse.move(
        inputBounds.x + inputBounds.width / 2,
        inputBounds.y + inputBounds.height / 2
      )
      await comfyPage.nextFrame()
      await expect
        .poll(() =>
          comfyPage.page.evaluate(() => {
            const link = window.app!.graph!.links.values().next().value
            return link ? window.app!.canvas.renderedPaths.has(link) : null
          })
        )
        .toBe(true)

      await comfyPage.canvasOps.moveMouseToEmptyArea()
      await comfyPage.nextFrame()
      await expect
        .poll(() =>
          comfyPage.page.evaluate(() => {
            const link = window.app!.graph!.links.values().next().value
            return link ? window.app!.canvas.renderedPaths.has(link) : null
          })
        )
        .toBe(false)

      const outputBounds = await outputSlot.boundingBox()
      if (!outputBounds) throw new Error('Output slot has no bounding box')
      await comfyPage.page.mouse.move(
        outputBounds.x + outputBounds.width / 2,
        outputBounds.y + outputBounds.height / 2
      )
      await comfyPage.nextFrame()
      await expect
        .poll(() =>
          comfyPage.page.evaluate(() => {
            const link = window.app!.graph!.links.values().next().value
            return link ? window.app!.canvas.renderedPaths.has(link) : null
          })
        )
        .toBe(true)
    })
  }
)
