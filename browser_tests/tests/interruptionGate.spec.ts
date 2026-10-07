import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { desktopFixture } from '@e2e/fixtures/desktopFixture'
import { createMockRelease } from '@e2e/fixtures/helpers/HelpCenterHelper'

interface ExposureEntry {
  surface: string
  outcome: string
  by?: string
}

interface ReleaseHold {
  release: () => void
}

const test = desktopFixture.extend<{ releaseHold: ReleaseHold }>({
  releaseHold: [
    async ({ page }, use) => {
      let release!: () => void
      const released = new Promise<void>((resolve) => {
        release = resolve
      })
      await page.route('**/releases**', async (route) => {
        const url = route.request().url()
        if (
          !url.includes('api.comfy.org') &&
          !url.includes('stagingapi.comfy.org')
        ) {
          await route.fallback()
          return
        }
        await released
        await route.fulfill({
          status: 200,
          json: [
            createMockRelease({
              version: 'v999.0.0',
              attention: 'high',
              content: '## New Features\n\n- A feature worth announcing'
            })
          ]
        })
      })
      await use({ release })
    },
    { auto: true }
  ]
})

test.use({ mockReleases: false })

function readExposures(page: Page) {
  return page.evaluate((): ExposureEntry[] => {
    const root = document.getElementById('vue-app') as unknown as {
      __vue_app__: {
        config: {
          globalProperties: { $pinia: { _s: Map<string, unknown> } }
        }
      }
    }
    const store = root.__vue_app__.config.globalProperties.$pinia._s.get(
      'interruption'
    ) as { exposures: ExposureEntry[] }
    return store.exposures.map(({ surface, outcome, by }) => ({
      surface,
      outcome,
      by
    }))
  })
}

test.describe('Interruption gate', { tag: ['@desktop'] }, () => {
  test('shows the release toast when nothing else is on screen', async ({
    comfyPage,
    releaseHold
  }) => {
    releaseHold.release()

    await expect(comfyPage.page.getByText('New update is out!')).toBeVisible()
    await expect
      .poll(() => readExposures(comfyPage.page))
      .toContainEqual(
        expect.objectContaining({ surface: 'releaseToast', outcome: 'shown' })
      )
  })

  test('holds the release toast behind an open dialog and shows it once closed', async ({
    comfyPage,
    releaseHold
  }) => {
    await comfyPage.settingDialog.open()

    releaseHold.release()

    await expect
      .poll(() => readExposures(comfyPage.page))
      .toContainEqual({
        surface: 'releaseToast',
        outcome: 'deferred',
        by: 'dialog'
      })
    await expect(comfyPage.page.getByText('New update is out!')).toBeHidden()

    await comfyPage.page.keyboard.press('Escape')
    await expect(comfyPage.settingDialog.root).toBeHidden()

    await expect(comfyPage.page.getByText('New update is out!')).toBeVisible()
    await expect
      .poll(() => readExposures(comfyPage.page))
      .toContainEqual(
        expect.objectContaining({ surface: 'releaseToast', outcome: 'shown' })
      )
  })
})
