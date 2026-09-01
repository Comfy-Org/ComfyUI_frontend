import { expect, mergeTests } from '@playwright/test'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { jobsRouteFixture } from '@e2e/fixtures/jobsRouteFixture'
import { mockGeneratedSidebarRoutes } from '@e2e/tests/assets/routeMockFixtures'
import {
  JOB_GAMMA_DETAIL,
  SAMPLE_JOBS
} from '@e2e/tests/assets/sidebarFixtures'

const test = comfyPageFixture
const routeTest = mergeTests(comfyPageFixture, jobsRouteFixture)

const cloudTest = test.extend<{ mockCloudAssetSidebarData: void }>({
  mockCloudAssetSidebarData: async ({ comfyPage }, use) => {
    await comfyPage.assets.mockOutputHistory(SAMPLE_JOBS)
    await comfyPage.assets.mockEmptyCloudAssets()

    await use()

    await comfyPage.assets.clearMocks()
  }
})

test.describe('Assets sidebar - selection', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.assets.mockOutputHistory(SAMPLE_JOBS)
    await comfyPage.assets.mockInputFiles([])
    await comfyPage.setup()
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.assets.clearMocks()
  })

  test('Clicking an asset card selects it', async ({ comfyPage }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()

    await tab.assetCards.first().click()

    await expect(tab.selectedCards).toHaveCount(1)
  })

  test('Ctrl+click adds to selection', async ({ comfyPage }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()

    const cards = tab.assetCards
    await expect.poll(() => cards.count()).toBeGreaterThanOrEqual(2)

    await cards.first().click()
    await expect(tab.selectedCards).toHaveCount(1)

    await cards.nth(1).click({ modifiers: ['ControlOrMeta'] })
    await expect(tab.selectedCards).toHaveCount(2)
  })

  test('Selection shows footer with count and actions', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()

    await tab.assetCards.first().click()

    await expect(tab.selectionCountButton).toBeVisible()
  })

  test('Deselect all clears selection', async ({ comfyPage }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()

    await tab.assetCards.first().click()
    await expect(tab.selectedCards).toHaveCount(1)

    await expect(tab.deselectAllButton).toBeVisible()
    await tab.deselectAllButton.click()
    await expect(tab.selectedCards).toHaveCount(0)
  })

  test('Selection is cleared when switching tabs', async ({ comfyPage }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()

    await tab.assetCards.first().click()
    await expect(tab.selectedCards).toHaveCount(1)

    await tab.switchToImported()

    await tab.switchToGenerated()
    await tab.waitForAssets()
    await expect(tab.selectedCards).toHaveCount(0)
  })
})

test.describe('Assets sidebar - bulk actions', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.assets.mockOutputHistory(SAMPLE_JOBS)
    await comfyPage.assets.mockInputFiles([])
    await comfyPage.setup()
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.assets.clearMocks()
  })

  test('Footer shows download button when assets selected', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()

    await tab.assetCards.first().click()

    await expect(tab.downloadSelectedButton).toBeVisible()
  })

  test('Footer shows delete button when output assets selected', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()

    await tab.assetCards.first().click()

    await expect(tab.deleteSelectedButton).toBeVisible()
  })

  test('Selection count displays correct number', async ({ comfyPage }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()

    const cards = tab.assetCards
    await expect.poll(() => cards.count()).toBeGreaterThanOrEqual(3)

    await cards.nth(1).click()
    await comfyPage.page.keyboard.down('Control')
    await cards.nth(2).click()
    await comfyPage.page.keyboard.up('Control')

    await expect(tab.selectionCountButton).toBeVisible()
    await expect(tab.selectionCountButton).toHaveText(/\b2 selected\b/)
  })

  test('Selection count sums the outputs of a stacked asset', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()

    await tab.assetCards.first().click()

    await expect(tab.selectionCountButton).toBeVisible()
    await expect(tab.selectionCountButton).toHaveText(/\b2 selected\b/)
  })

  test('Selection bar stays capped, not stretched, on a wide panel', async ({
    comfyPage
  }) => {
    await comfyPage.page.setViewportSize({ width: 1600, height: 900 })
    const tab = comfyPage.menu.assetsTab
    await tab.open()

    const gutter = comfyPage.page.locator('.p-splitter-gutter').first()
    await expect(gutter).toBeVisible()
    const gutterBox = await gutter.boundingBox()
    if (!gutterBox) {
      throw new Error('sidebar splitter gutter has no bounding box')
    }
    await comfyPage.page.mouse.move(
      gutterBox.x + gutterBox.width / 2,
      gutterBox.y + gutterBox.height / 2
    )
    await comfyPage.page.mouse.down()
    await comfyPage.page.mouse.move(900, gutterBox.y + gutterBox.height / 2, {
      steps: 12
    })
    await comfyPage.page.mouse.up()

    await tab.assetCards.first().click()
    await expect(tab.selectionFooter).toBeVisible()

    const sidebar = comfyPage.page.locator('.side-bar-panel').first()
    await expect
      .poll(async () => (await sidebar.boundingBox())?.width ?? 0)
      .toBeGreaterThan(520)
    await expect
      .poll(async () => {
        const bar = await tab.selectionFooter.boundingBox()
        const side = await sidebar.boundingBox()
        return bar && side ? side.width - bar.width : 0
      })
      .toBeGreaterThan(100)
  })
})

cloudTest.describe('Assets sidebar - cloud exports', { tag: '@cloud' }, () => {
  cloudTest(
    'Single job selection uses preserve naming strategy',
    async ({ comfyPage, mockCloudAssetSidebarData }) => {
      void mockCloudAssetSidebarData
      const exportRequests = await comfyPage.assets.captureAssetExportRequests()

      const tab = comfyPage.menu.assetsTab
      await tab.open()

      await tab.assetCards.first().click()
      await expect(tab.downloadSelectedButton).toBeVisible()

      await tab.downloadSelectedButton.click()

      await expect.poll(() => exportRequests).toHaveLength(1)

      const payload = exportRequests[0]
      expect(payload.job_ids).toEqual(['job-gamma'])
      expect(payload.job_asset_name_filters).toBeUndefined()
      expect(payload.naming_strategy).toBe('preserve')
    }
  )

  cloudTest(
    'Multiple selected assets from one job use preserve naming strategy',
    async ({ comfyPage, mockCloudAssetSidebarData }) => {
      void mockCloudAssetSidebarData
      const exportRequests = await comfyPage.assets.captureAssetExportRequests()
      await comfyPage.assets.mockJobDetail('job-gamma', JOB_GAMMA_DETAIL)

      const tab = comfyPage.menu.assetsTab
      await tab.open()

      await tab.assetCards
        .first()
        .getByRole('button', { name: 'See more outputs' })
        .click()
      await expect(tab.backToAssetsButton).toBeVisible()
      await expect.poll(() => tab.assetCards.count()).toBe(2)

      await tab.assetCards.first().click()
      await comfyPage.page.keyboard.down('Control')
      await tab.assetCards.nth(1).click()
      await comfyPage.page.keyboard.up('Control')

      await expect(tab.selectedCards).toHaveCount(2)
      await tab.downloadSelectedButton.click()

      await expect.poll(() => exportRequests).toHaveLength(1)

      const payload = exportRequests[0]
      expect(payload.job_ids).toEqual(['job-gamma'])
      expect(payload.job_asset_name_filters?.['job-gamma']?.toSorted()).toEqual(
        ['abstract_art.png', 'abstract_art_alt.png']
      )
      expect(payload.naming_strategy).toBe('preserve')
    }
  )

  cloudTest(
    'Multiple selected jobs use job-time naming strategy',
    async ({ comfyPage, mockCloudAssetSidebarData }) => {
      void mockCloudAssetSidebarData
      const exportRequests = await comfyPage.assets.captureAssetExportRequests()

      const tab = comfyPage.menu.assetsTab
      await tab.open()

      await tab.assetCards.nth(1).click()
      await comfyPage.page.keyboard.down('Control')
      await tab.assetCards.nth(2).click()
      await comfyPage.page.keyboard.up('Control')

      await expect(tab.selectedCards).toHaveCount(2)
      await tab.downloadSelectedButton.click()

      await expect.poll(() => exportRequests).toHaveLength(1)

      const payload = exportRequests[0]
      expect(payload.job_ids?.toSorted()).toEqual(['job-alpha', 'job-beta'])
      expect(payload.job_asset_name_filters).toBeUndefined()
      expect(payload.naming_strategy).toBe('group_by_job_time')
    }
  )
})

routeTest.describe('Assets sidebar - marquee selection and select all', () => {
  routeTest.beforeEach(async ({ jobsRoutes, page, comfyPage }) => {
    await mockGeneratedSidebarRoutes(page, jobsRoutes)
    await comfyPage.setup()
    await comfyPage.menu.assetsTab.open()
  })

  routeTest(
    'Ctrl/Cmd+A selects every asset while the panel is hovered',
    async ({ comfyPage }) => {
      const tab = comfyPage.menu.assetsTab

      await expect(tab.assetCards).toHaveCount(2)

      await tab.getAssetCardByName('alpha').hover()
      await comfyPage.page.keyboard.press('ControlOrMeta+a')

      await expect(tab.selectedCards).toHaveCount(2)
    }
  )

  routeTest(
    'a marquee that begins in the panel header selects the cards',
    async ({ comfyPage }) => {
      const tab = comfyPage.menu.assetsTab
      const { page } = comfyPage

      await expect(tab.assetCards).toHaveCount(2)
      await expect(tab.selectedCards).toHaveCount(0)

      const header = await tab.panelHeader.boundingBox()
      const beta = await tab.getAssetCardByName('beta').boundingBox()
      if (!header || !beta) {
        throw new Error('panel header or asset card has no layout box')
      }

      await page.mouse.move(header.x + 24, header.y + 20)
      await page.mouse.down()
      await page.mouse.move(beta.x + 8, beta.y + beta.height - 8, { steps: 14 })
      await page.mouse.up()

      await expect(tab.selectedCards).toHaveCount(2)
      await expect(tab.selectionFooter).toBeVisible()
    }
  )

  routeTest(
    'Ctrl/Cmd+A leaves assets unselected while the canvas is hovered',
    async ({ comfyPage }) => {
      const tab = comfyPage.menu.assetsTab
      const { page } = comfyPage

      await expect(tab.assetCards).toHaveCount(2)

      const viewport = page.viewportSize()
      if (!viewport) throw new Error('viewport size is unavailable')

      await page.mouse.move(viewport.width - 100, viewport.height / 2)
      await page.keyboard.press('ControlOrMeta+a')

      await expect(tab.selectedCards).toHaveCount(0)
    }
  )

  routeTest(
    'a modifier-held marquee adds to the existing selection',
    async ({ comfyPage }) => {
      const tab = comfyPage.menu.assetsTab
      const { page } = comfyPage

      await expect(tab.assetCards).toHaveCount(2)

      await tab.getAssetCardByName('alpha').click()
      await expect(tab.selectedCards).toHaveCount(1)

      const beta = await tab.getAssetCardByName('beta').boundingBox()
      if (!beta) throw new Error('beta card has no layout box')

      await page.keyboard.down('Control')
      await page.mouse.move(beta.x + 12, beta.y + 12)
      await page.mouse.down()
      await page.mouse.move(
        beta.x + beta.width - 12,
        beta.y + beta.height - 12,
        {
          steps: 12
        }
      )
      await page.mouse.up()
      await page.keyboard.up('Control')

      await expect(tab.selectedCards).toHaveCount(2)
    }
  )

  routeTest(
    'a Ctrl/Cmd+Shift marquee removes the covered cards from the selection',
    async ({ comfyPage }) => {
      const tab = comfyPage.menu.assetsTab
      const { page } = comfyPage

      await expect(tab.assetCards).toHaveCount(2)

      await tab.getAssetCardByName('alpha').hover()
      await page.keyboard.press('ControlOrMeta+a')
      await expect(tab.selectedCards).toHaveCount(2)

      const beta = await tab.getAssetCardByName('beta').boundingBox()
      if (!beta) throw new Error('beta card has no layout box')

      await page.keyboard.down('Control')
      await page.keyboard.down('Shift')
      await page.mouse.move(beta.x + 12, beta.y + 12)
      await page.mouse.down()
      await page.mouse.move(
        beta.x + beta.width - 12,
        beta.y + beta.height - 12,
        {
          steps: 12
        }
      )
      await page.mouse.up()
      await page.keyboard.up('Shift')
      await page.keyboard.up('Control')

      await expect(tab.selectedCards).toHaveCount(1)
      await expect(tab.getAssetCardByName('alpha')).toHaveAttribute(
        'data-selected',
        'true'
      )
    }
  )

  routeTest(
    'Ctrl/Cmd-dragging from an asset card starts a marquee selection',
    async ({ comfyPage }) => {
      const tab = comfyPage.menu.assetsTab
      const { page } = comfyPage

      await expect(tab.assetCards).toHaveCount(2)
      await expect(tab.selectedCards).toHaveCount(0)

      const alpha = await tab.getAssetCardByName('alpha').boundingBox()
      const beta = await tab.getAssetCardByName('beta').boundingBox()
      if (!alpha || !beta) throw new Error('asset cards have no layout box')

      await page.keyboard.down('Control')
      await page.mouse.move(
        alpha.x + alpha.width / 2,
        alpha.y + alpha.height / 2
      )
      await page.mouse.down()
      await page.mouse.move(beta.x + beta.width - 6, beta.y + beta.height - 6, {
        steps: 12
      })
      await page.mouse.up()
      await page.keyboard.up('Control')

      await expect(tab.selectedCards).toHaveCount(2)
      await expect(tab.selectionFooter).toBeVisible()
    }
  )

  routeTest(
    'Ctrl/Cmd-dragging within a single card selects only that card',
    async ({ comfyPage }) => {
      const tab = comfyPage.menu.assetsTab
      const { page } = comfyPage

      await expect(tab.assetCards).toHaveCount(2)

      const alpha = tab.getAssetCardByName('alpha')
      const box = await alpha.boundingBox()
      if (!box) throw new Error('alpha card has no layout box')

      const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
      await page.keyboard.down('Control')
      await page.mouse.move(start.x, start.y)
      await page.mouse.down()
      await page.mouse.move(start.x + 12, start.y + 12, { steps: 4 })
      await page.mouse.up()
      await page.keyboard.up('Control')

      await expect(tab.selectedCards).toHaveCount(1)
      await expect(alpha).toHaveAttribute('data-selected', 'true')
    }
  )

  routeTest(
    'Ctrl/Cmd+A in the focused search input does not select assets',
    async ({ comfyPage }) => {
      const tab = comfyPage.menu.assetsTab
      const query = 'alpha'

      await tab.searchInput.fill(query)
      await expect(tab.assetCards).toHaveCount(1)

      await tab.searchInput.focus()
      await comfyPage.page.keyboard.press('ControlOrMeta+a')

      await expect(tab.selectedCards).toHaveCount(0)
      await expect
        .poll(() =>
          tab.searchInput.evaluate((el: HTMLInputElement) => {
            return { start: el.selectionStart, end: el.selectionEnd }
          })
        )
        .toEqual({ start: 0, end: query.length })
    }
  )

  routeTest(
    'a drag starting in the search input does not marquee-select assets',
    async ({ comfyPage }) => {
      const tab = comfyPage.menu.assetsTab
      const { page } = comfyPage

      await expect(tab.assetCards).toHaveCount(2)

      const search = await tab.searchInput.boundingBox()
      const beta = await tab.getAssetCardByName('beta').boundingBox()
      if (!search || !beta)
        throw new Error('search box or card has no layout box')

      await page.mouse.move(
        search.x + search.width / 2,
        search.y + search.height / 2
      )
      await page.mouse.down()
      await page.mouse.move(beta.x + beta.width / 2, beta.y + beta.height / 2, {
        steps: 12
      })
      await page.mouse.up()

      await expect(tab.selectedCards).toHaveCount(0)
    }
  )

  routeTest(
    'Ctrl/Cmd+A does not select assets while an aria-modal dialog is open',
    async ({ comfyPage }) => {
      const tab = comfyPage.menu.assetsTab
      await expect(tab.assetCards).toHaveCount(2)

      await comfyPage.page.evaluate(() => {
        const dialog = document.createElement('div')
        dialog.id = 'test-modal'
        dialog.setAttribute('role', 'dialog')
        dialog.setAttribute('aria-modal', 'true')
        document.body.appendChild(dialog)
      })

      await tab.getAssetCardByName('alpha').hover()
      await comfyPage.page.keyboard.press('ControlOrMeta+a')

      await expect(tab.selectedCards).toHaveCount(0)

      await comfyPage.page.evaluate(() => {
        document.getElementById('test-modal')?.remove()
      })
    }
  )
})
