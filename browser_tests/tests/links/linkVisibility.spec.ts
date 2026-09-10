import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import { test } from '@e2e/fixtures/linkVisibilityFixture'

test.use({
  initialSettings: { 'Comfy.UseNewMenu': 'Disabled' }
})

test.describe('Hidden link badges', { tag: ['@canvas', '@screenshot'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('reroute/native_reroute')
  })

  test('hides and restores a link from canvas gestures', async ({
    comfyPage,
    linkVisibility
  }) => {
    await expect(comfyPage.canvas).toHaveScreenshot('link-visible.png')

    await linkVisibility.hideFirstLink()

    await expect(comfyPage.canvas).toHaveScreenshot('link-hidden.png')

    await linkVisibility.hoverFirstHiddenLink()
    await expect(comfyPage.canvas).toHaveScreenshot('link-hidden-revealed.png')

    await linkVisibility.showFirstHiddenLink()

    await expect(comfyPage.canvas).toHaveScreenshot('link-visible.png')
  })

  test('persists a hidden renamed link through graph load and browser reload', async ({
    comfyPage,
    linkVisibility
  }) => {
    await linkVisibility.hideFirstLink()

    const serialized = await comfyPage.workflow.getExportedWorkflow()
    const serializedLink = serialized.links?.[0]
    if (!serializedLink) throw new Error('Exported workflow link was not found')
    const linkId = String(
      Array.isArray(serializedLink) ? serializedLink[0] : serializedLink.id
    )
    expect(serialized.extra?.linkPresentation).toEqual({
      [linkId]: { hidden: true }
    })

    await comfyPage.workflow.loadGraphData(serialized)
    await comfyPage.nextFrame()

    await expect(comfyPage.canvas).toHaveScreenshot('link-hidden.png')

    await linkVisibility.openRenamePrompt()

    await expect(linkVisibility.promptInput).toHaveValue('')

    await linkVisibility.promptInput.fill('Renamed badge')
    await linkVisibility.promptInput.press('Enter')

    await expect(linkVisibility.promptInput).toBeHidden()
    await expect
      .poll(async () => {
        const workflow = await comfyPage.workflow.getExportedWorkflow()
        return workflow.extra?.linkPresentation?.[linkId]
      })
      .toEqual({ hidden: true, label: 'Renamed badge' })

    await comfyPage.workflow.reloadAndWaitForApp()

    await expect
      .poll(async () => {
        const workflow = await comfyPage.workflow.getExportedWorkflow()
        return workflow.extra?.linkPresentation?.[linkId]
      })
      .toEqual({ hidden: true, label: 'Renamed badge' })
  })
})

test.describe(
  'Hidden link Vue slot reveal',
  { tag: ['@canvas', '@vue-nodes', '@screenshot'] },
  () => {
    test('reveals the link while connected input and output slots are hovered', async ({
      comfyPage,
      linkVisibility
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

      const midpointHandle = await comfyPage.page.waitForFunction(() => {
        const graph = window.app?.graph
        if (!graph) return null
        const source = graph.nodes.find(
          (node) => node.title === 'Load Checkpoint'
        )
        const target = graph.nodes.find((node) => node.title === 'VAE Decode')
        if (!source || !target) return null
        const outputIndex = source.outputs.findIndex(
          (slot) => slot.name === 'VAE'
        )
        const inputIndex = target.inputs.findIndex(
          (slot) => slot.name === 'vae'
        )
        const link = [...graph.links.values()].find(
          (candidate) =>
            candidate.origin_id === source.id &&
            candidate.origin_slot === outputIndex &&
            candidate.target_id === target.id &&
            candidate.target_slot === inputIndex
        )
        const pos = link?._pos
        return pos ? { x: pos[0], y: pos[1] } : null
      })
      const midpoint = await midpointHandle.jsonValue()
      if (!midpoint) throw new Error('Workflow link was not found')

      await linkVisibility.hideLinkAt([midpoint.x, midpoint.y])

      await expect(comfyPage.canvas).toHaveScreenshot('vue-link-hidden.png')

      const inputBounds = await inputSlot.boundingBox()
      if (!inputBounds) throw new Error('Input slot has no bounding box')
      await comfyPage.page.mouse.move(
        inputBounds.x + inputBounds.width / 2,
        inputBounds.y + inputBounds.height / 2
      )
      await comfyPage.nextFrame()

      await expect(comfyPage.canvas).toHaveScreenshot(
        'vue-link-revealed-from-input.png'
      )

      await linkVisibility.parkPointer()

      await expect(comfyPage.canvas).toHaveScreenshot('vue-link-hidden.png')

      const outputBounds = await outputSlot.boundingBox()
      if (!outputBounds) throw new Error('Output slot has no bounding box')
      await comfyPage.page.mouse.move(
        outputBounds.x + outputBounds.width / 2,
        outputBounds.y + outputBounds.height / 2
      )
      await comfyPage.nextFrame()

      await expect(comfyPage.canvas).toHaveScreenshot(
        'vue-link-revealed-from-output.png'
      )

      await linkVisibility.parkPointer()

      await expect(comfyPage.canvas).toHaveScreenshot('vue-link-hidden.png')
    })
  }
)
