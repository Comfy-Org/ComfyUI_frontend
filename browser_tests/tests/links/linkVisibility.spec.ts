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
