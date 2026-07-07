import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { NodeError } from '@/schemas/apiSchema'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import { enableErrorsOverlay } from '@e2e/fixtures/helpers/ErrorsTabHelper'
import { TestIds } from '@e2e/fixtures/selectors'

const SAVE_IMAGE_NODE_ID = '9'

function buildSaveImageRequiredInputError(): NodeError {
  return {
    class_type: 'SaveImage',
    dependent_outputs: [],
    errors: [
      {
        type: 'required_input_missing',
        message: 'Required input is missing: images',
        details: '',
        extra_info: { input_name: 'images' }
      },
      {
        type: 'value_smaller_than_min',
        message: 'Value -1 smaller than min of 0',
        details: '',
        extra_info: { input_name: 'quality' }
      }
    ]
  }
}

test.describe('Error resolution view', { tag: ['@ui', '@workflow'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await enableErrorsOverlay(comfyPage)
    await comfyPage.settings.setSetting('Comfy.Minimap.Visible', false)
    await comfyPage.workflow.loadWorkflow('linear-validation-warning')
    await comfyPage.appMode.toggleAppMode()
    await expect(comfyPage.appMode.linearWidgets).toBeVisible()

    const exec = new ExecutionHelper(comfyPage)
    await exec.mockValidationFailure({
      [SAVE_IMAGE_NODE_ID]: buildSaveImageRequiredInputError()
    })
    await comfyPage.appMode.runButton.click()
    await expect(comfyPage.appMode.validationWarning).toBeVisible()
    await comfyPage.appMode.viewErrorsInGraphButton.click()
  })

  test('shows canvas with error panel and hides UI chrome', async ({
    comfyPage
  }) => {
    await expect(comfyPage.canvas).toBeVisible()
    await expect(
      comfyPage.page.getByTestId(TestIds.errorResolution.panel)
    ).toBeVisible()
    await expect(
      comfyPage.page.getByTestId(TestIds.errorResolution.back)
    ).toBeVisible()
    await expect(comfyPage.menu.sideToolbar).toBeHidden()

    // FitView on entry must wait for the canvas to be re-measured; fitting
    // a zero-sized canvas corrupts the view transform (scale 0 / NaN)
    await expect
      .poll(() =>
        comfyPage.page.evaluate(() => {
          const { scale, offset } = window.app!.canvas.ds
          return (
            Number.isFinite(scale) &&
            scale > 0.01 &&
            Number.isFinite(offset[0]) &&
            Number.isFinite(offset[1])
          )
        })
      )
      .toBe(true)
  })

  test('back button returns to app mode and restores chrome on next graph entry', async ({
    comfyPage
  }) => {
    await comfyPage.page.getByTestId(TestIds.errorResolution.back).click()

    await expect(comfyPage.appMode.linearWidgets).toBeVisible()
    await expect(
      comfyPage.page.getByTestId(TestIds.errorResolution.panel)
    ).toBeHidden()

    await comfyPage.appMode.toggleAppMode()
    await expect(comfyPage.menu.sideToolbar).toBeVisible()
  })

  test('locating an error node keeps the panel open', async ({ comfyPage }) => {
    const panel = comfyPage.page.getByTestId(TestIds.errorResolution.panel)
    await panel
      .getByRole('button', { name: /locate/i })
      .first()
      .click()
    await comfyPage.nextFrame()

    await expect(panel).toBeVisible()
    await expect(
      comfyPage.page.getByTestId(TestIds.errorResolution.back)
    ).toBeVisible()
  })

  test('narrow viewport shows collapsible top bar with card carousel', async ({
    comfyPage
  }) => {
    await comfyPage.page.setViewportSize({ width: 375, height: 812 })

    const panel = comfyPage.page.getByTestId(TestIds.errorResolution.panel)
    await expect(panel).toBeVisible()
    await expect(panel.getByTestId(TestIds.errorResolution.back)).toBeVisible()

    const errorCards = panel.getByTestId('error-group-execution')
    await expect(errorCards.first()).toBeVisible()
    // The summary hero is replaced by the top bar count in carousel layout
    await expect(panel.getByTestId('errors-summary-hero')).toBeHidden()

    // Two catalog groups → two carousel slides with position dots
    await expect(errorCards).toHaveCount(2)
    const dots = panel.getByTestId('error-carousel-dots').getByRole('button')
    await expect(dots).toHaveCount(2)
    await expect(dots.first()).toHaveAttribute('aria-current', 'true')

    // Each slide spans the full track width (one card per view)
    const cardBox = await errorCards.first().boundingBox()
    const panelBox = await panel.boundingBox()
    expect(cardBox!.width).toBeGreaterThan(panelBox!.width * 0.8)

    // Clicking a dot swipes to that slide
    await dots.nth(1).click()
    await expect(dots.nth(1)).toHaveAttribute('aria-current', 'true')

    await panel.getByRole('button', { name: /hide errors/i }).click()
    await expect(errorCards.first()).toBeHidden()

    await panel.getByRole('button', { name: /show errors/i }).click()
    await expect(errorCards.first()).toBeVisible()
  })

  test('desktop panel does not cover the minimap', async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.Minimap.Visible', true)
    const panel = comfyPage.page.getByTestId(TestIds.errorResolution.panel)
    const minimap = comfyPage.page.getByTestId('minimap-container')
    await expect(panel).toBeVisible()
    await expect(minimap).toBeVisible()

    const panelBox = await panel.boundingBox()
    const minimapBox = await minimap.boundingBox()
    expect(panelBox).not.toBeNull()
    expect(minimapBox).not.toBeNull()
    expect(panelBox!.y + panelBox!.height).toBeLessThanOrEqual(minimapBox!.y)
  })

  test('desktop panel does not cover the canvas menu when minimap is hidden', async ({
    comfyPage
  }) => {
    await comfyPage.settings.setSetting('Comfy.Graph.CanvasMenu', true)
    await comfyPage.settings.setSetting('Comfy.Minimap.Visible', false)
    const panel = comfyPage.page.getByTestId(TestIds.errorResolution.panel)
    const minimapToggle = comfyPage.page.getByTestId('toggle-minimap-button')
    await expect(panel).toBeVisible()
    await expect(minimapToggle).toBeVisible()

    const panelBox = await panel.boundingBox()
    const toggleBox = await minimapToggle.boundingBox()
    expect(panelBox).not.toBeNull()
    expect(toggleBox).not.toBeNull()
    expect(panelBox!.y + panelBox!.height).toBeLessThanOrEqual(toggleBox!.y)
  })

  test('right screen edge has no splitter gutter hit area', async ({
    comfyPage
  }) => {
    await expect(
      comfyPage.page.getByTestId(TestIds.errorResolution.panel)
    ).toBeVisible()

    const edgeHitsGutter = await comfyPage.page.evaluate(() => {
      const x = window.innerWidth - 1
      for (const y of [100, window.innerHeight / 2, window.innerHeight - 100]) {
        const el = document.elementFromPoint(x, y)
        if (el?.closest('.p-splitter-gutter')) return true
      }
      return false
    })
    expect(edgeHitsGutter).toBe(false)
  })
})
