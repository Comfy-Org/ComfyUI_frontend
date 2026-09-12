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

    await test.step('Hide the link', async () => {
      await linkVisibility.hideFirstLink()
      await expect(comfyPage.canvas).toHaveScreenshot('link-hidden.png')
    })

    await test.step('Hovering the badge reveals the hidden link', async () => {
      await linkVisibility.hoverFirstHiddenLink()
      await expect(comfyPage.canvas).toHaveScreenshot(
        'link-hidden-revealed.png'
      )
    })

    await test.step('Leaving the badge hides the link again', async () => {
      await linkVisibility.parkPointer()
      await expect(comfyPage.canvas).toHaveScreenshot('link-hidden.png')
    })

    await test.step('Show the link', async () => {
      await linkVisibility.showFirstHiddenLink()
      await expect(comfyPage.canvas).toHaveScreenshot('link-visible.png')
    })
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

      await test.step('Hide the link', async () => {
        await linkVisibility.hideLinkBetween({
          sourceTitle: 'Load Checkpoint',
          outputName: 'VAE',
          targetTitle: 'VAE Decode',
          inputName: 'vae'
        })
        await expect(comfyPage.canvas).toHaveScreenshot('vue-link-hidden.png')
      })

      await test.step('Input hover reveals the hidden link', async () => {
        await inputSlot.hover()
        await comfyPage.nextFrame()
        await expect(comfyPage.canvas).toHaveScreenshot(
          'vue-link-revealed-from-input.png'
        )
      })

      await test.step('Leaving the input hides the link again', async () => {
        await linkVisibility.parkPointer()
        await expect(comfyPage.canvas).toHaveScreenshot('vue-link-hidden.png')
      })

      await test.step('Output hover reveals the hidden link', async () => {
        await outputSlot.hover()
        await comfyPage.nextFrame()
        await expect(comfyPage.canvas).toHaveScreenshot(
          'vue-link-revealed-from-output.png'
        )
      })

      await test.step('Leaving the output hides the link again', async () => {
        await linkVisibility.parkPointer()
        await expect(comfyPage.canvas).toHaveScreenshot('vue-link-hidden.png')
      })
    })
  }
)
