import { expect, mergeTests } from '@playwright/test'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import {
  sharedWorkflowImportFixture,
  sharedWorkflowImportScenario
} from '@e2e/fixtures/sharedWorkflowImportFixture'
import type { SharedWorkflowImportMocks } from '@e2e/fixtures/sharedWorkflowImportFixture'
import { PropertiesPanelHelper } from '@e2e/tests/propertiesPanel/PropertiesPanelHelper'

const IMPORT_ORDER_TIMEOUT_MS = 5_000
const MISSING_MEDIA_SETTLING_WINDOW_MS = 1_000

async function expectImportPrecedesPublicInclusiveInputAssetScan(
  mocks: SharedWorkflowImportMocks
): Promise<void> {
  await expect(async () => {
    const events = mocks.getRequestEvents()
    const importIndex = events.indexOf('import')
    const afterImportIndex = events.indexOf(
      'input-assets-including-public-after-import'
    )

    expect(
      events,
      'public-inclusive input assets must not be scanned before import'
    ).not.toContain('input-assets-including-public-before-import')
    expect(importIndex, `events: ${events.join(',')}`).toBeGreaterThanOrEqual(0)
    expect(afterImportIndex, `events: ${events.join(',')}`).toBeGreaterThan(
      importIndex
    )
  }).toPass({ timeout: IMPORT_ORDER_TIMEOUT_MS })
}

async function expectNoMissingMediaOverlayDuringSettling(
  comfyPage: ComfyPage
): Promise<void> {
  await expect(
    comfyPage.page.evaluate(
      async ({ errorOverlay, settlingWindowMs }) => {
        const isVisible = (element: Element | null) => {
          if (!element) return false
          const style = window.getComputedStyle(element)
          const rect = element.getBoundingClientRect()
          return (
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            rect.width > 0 &&
            rect.height > 0
          )
        }

        const startedAt = performance.now()
        return await new Promise<boolean>((resolve) => {
          const check = () => {
            if (
              isVisible(
                document.querySelector(`[data-testid="${errorOverlay}"]`)
              )
            ) {
              resolve(false)
              return
            }

            if (performance.now() - startedAt >= settlingWindowMs) {
              resolve(true)
              return
            }

            requestAnimationFrame(check)
          }

          check()
        })
      },
      {
        errorOverlay: TestIds.dialogs.errorOverlay,
        settlingWindowMs: MISSING_MEDIA_SETTLING_WINDOW_MS
      }
    )
  ).resolves.toBe(true)
}

async function openPanelAndExpectNoMissingMedia(
  comfyPage: ComfyPage
): Promise<void> {
  const page = comfyPage.page
  const errorOverlay = page.getByTestId(TestIds.dialogs.errorOverlay)
  await expect(errorOverlay).toBeHidden()

  const panel = new PropertiesPanelHelper(page)
  await panel.open(comfyPage.actionbar.propertiesButton)
  await expect(
    panel.root.getByTestId(TestIds.propertiesPanel.errorsTab)
  ).toBeHidden()
  await expect(page.getByTestId(TestIds.dialogs.missingMediaGroup)).toHaveCount(
    0
  )
}

const test = mergeTests(comfyPageFixture, sharedWorkflowImportFixture)

test.describe('Shared workflow missing media', { tag: '@cloud' }, () => {
  // Missing media only surfaces the overlay when the Errors tab is enabled.
  test.use({
    initialSettings: {
      'Comfy.RightSidePanel.ShowErrorsTab': true
    }
  })

  test.beforeEach(async ({ comfyPage, sharedWorkflowImportMocks }) => {
    sharedWorkflowImportMocks.resetAndStartRecording()
    await comfyPage.setup({
      clearStorage: false,
      url: `/?share=${sharedWorkflowImportScenario.shareId}`
    })
  })

  test('imports shared media before loading workflow so missing media is not surfaced', async ({
    comfyPage,
    sharedWorkflowImportMocks
  }) => {
    const { page } = comfyPage

    const dialog = page.getByTestId(TestIds.dialogs.openSharedWorkflow)
    await expect(
      dialog.getByTestId(TestIds.dialogs.openSharedWorkflowTitle)
    ).toBeVisible()

    await dialog.getByTestId(TestIds.dialogs.openSharedWorkflowConfirm).click()

    await expect
      .poll(() =>
        page.evaluate(() =>
          window.app!.graph.nodes.map((node) => ({
            type: node.type,
            value: node.widgets?.[0]?.value
          }))
        )
      )
      .toEqual([
        {
          type: 'LoadImage',
          value: sharedWorkflowImportScenario.inputFileName
        }
      ])
    await expectImportPrecedesPublicInclusiveInputAssetScan(
      sharedWorkflowImportMocks
    )
    await expectNoMissingMediaOverlayDuringSettling(comfyPage)

    expect(sharedWorkflowImportMocks.getImportBody()).toEqual({
      published_asset_ids: [sharedWorkflowImportScenario.publishedAssetId],
      share_id: sharedWorkflowImportScenario.shareId
    })
    expect(new URL(page.url()).searchParams.has('share')).toBe(false)
    await openPanelAndExpectNoMissingMedia(comfyPage)
  })
})
