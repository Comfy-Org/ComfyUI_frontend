import assert from 'node:assert/strict'

import { expect } from '@playwright/test'

import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { AssetsSidebarTab } from '@e2e/fixtures/components/SidebarTab'
import { AGENT_VIDEO_ASSET } from '@e2e/fixtures/data/assetFixtures'
import {
  agentTest as test,
  bootAgentApp
} from '@e2e/fixtures/agentPanelFixture'
import { assetPath } from '@e2e/fixtures/utils/paths'

// The composer's "drag in asset from asset panel" path had no browser coverage
// at all, in either view mode: the drag source was proved by asserting the
// CANVAS consumer of the same payload, which cannot catch a composer-side
// attach regression. PM-1401 (a list row that never started a drag) and
// PM-1157/PM-1158 (a drag that attaches the wrong preview) both live here.
//
// The drop side accepts a drop purely on `dataTransfer.types` containing
// `application/x-comfy-asset-info` (`AgentPanelRoot` `isAssetDrag`), so it is
// view-agnostic by construction; what these cases pin is that every view mode
// actually publishes that payload, and that the chip names the asset dragged.
const ASSET_NAME = AGENT_VIDEO_ASSET.name

test.describe('Agent composer asset drop', { tag: '@cloud' }, () => {
  test.beforeEach(async ({ page, agentFlagEnabled }) => {
    // Only the file's own id serves the MP4; the job id gets the backend's
    // 404 body. Registered before boot so the seeded list route, which is
    // scoped to the list endpoint, does not shadow it.
    await page.route(
      new RegExp(`/api/assets/${AGENT_VIDEO_ASSET.id}/content(\\?.*)?$`),
      async (route) =>
        await route.fulfill({
          path: assetPath('workflowInMedia/workflow.mp4'),
          contentType: 'video/mp4'
        })
    )

    await bootAgentApp(page, agentFlagEnabled, {
      assets: {
        assets: [{ ...AGENT_VIDEO_ASSET, display_name: null }],
        total: 1,
        has_more: false
      }
    })
  })

  for (const view of ['grid', 'list'] as const) {
    test(`re-attaches a library asset without a display name from ${view} view`, async ({
      page
    }) => {
      const agentPanel = new AgentPanel(page)
      await agentPanel.open()

      const assets = new AssetsSidebarTab(page)
      await assets.open()

      if (view === 'list') {
        await assets.openSettingsMenu()
        await assets.listViewOption.click()
        await assets.closeSettingsMenu()
      }

      const source =
        view === 'list'
          ? assets.listViewItems.first()
          : assets.assetCards.first()
      await expect(source).toBeVisible()
      await expect(agentPanel.attachmentChips).toHaveCount(0)

      await source.dragTo(agentPanel.root)

      // Named, not merely present: a drag that attaches the wrong asset is the
      // PM-1157/PM-1158 failure, and it would pass a bare count assertion.
      await expect(agentPanel.attachmentChip(ASSET_NAME)).toBeVisible()
      await expect(agentPanel.attachmentChips).toHaveCount(1)
      await source.dragTo(agentPanel.root)
      await expect(agentPanel.attachmentChips).toHaveCount(1)
      const duplicateNotice = page.getByRole('alert').filter({
        hasText: `${ASSET_NAME} is already in the asset tray`
      })
      await expect(duplicateNotice).toHaveCount(1)
      await duplicateNotice.getByRole('button', { name: 'Close' }).click()
      await agentPanel.composer.fill('Keep this draft @agent_generated')
      await agentPanel.root
        .getByRole('menuitem', { name: ASSET_NAME, exact: true })
        .click()
      await expect(
        agentPanel.composer.getByTestId('asset-reference-chip')
      ).toHaveCount(1)
      await agentPanel.attachmentChip(ASSET_NAME).hover()
      await agentPanel
        .attachmentChip(ASSET_NAME)
        .getByRole('button', { name: `Remove ${ASSET_NAME}`, exact: true })
        .click()
      await expect(agentPanel.attachmentChips).toHaveCount(0)
      await expect(
        agentPanel.composer.getByTestId('asset-reference-chip')
      ).toHaveCount(0)
      await expect(agentPanel.composer).toContainText('Keep this draft')
      await source.dragTo(agentPanel.root)
      await expect(agentPanel.attachmentChip(ASSET_NAME)).toBeVisible()
      await expect(agentPanel.attachmentChips).toHaveCount(1)
      await agentPanel.composer.press('End')
      await agentPanel.composer.pressSequentially('@agent_generated')
      await agentPanel.root
        .getByRole('menuitem', { name: ASSET_NAME, exact: true })
        .click()
      await expect(
        agentPanel.composer.getByTestId('asset-reference-chip')
      ).toHaveCount(1)
    })
  }

  test('reuses a decoded video poster and supports native keyboard playback with cleanup', async ({
    page
  }) => {
    const agentPanel = new AgentPanel(page)
    await agentPanel.open()
    const assets = new AssetsSidebarTab(page)
    await assets.open()
    await assets.assetCards.first().dragTo(agentPanel.root)
    const poster = agentPanel
      .attachmentChip(ASSET_NAME)
      .getByRole('img', { name: ASSET_NAME, exact: true })
    await expect(poster).toHaveAttribute('src', /^blob:/)
    await expect
      .poll(() =>
        poster.evaluate(
          (image: HTMLImageElement) => image.complete && image.naturalWidth > 0
        )
      )
      .toBe(true)
    const posterUrl = await poster.getAttribute('src')
    assert(posterUrl)
    await agentPanel.composer.fill('Animate @agent_generated')
    const suggestion = agentPanel.root.getByRole('menuitem', {
      name: ASSET_NAME,
      exact: true
    })
    await expect(suggestion.locator('img')).toHaveAttribute('src', posterUrl)
    await suggestion.click()
    await expect(
      agentPanel.composer.getByTestId('asset-reference-chip').locator('img')
    ).toHaveAttribute('src', posterUrl)
    await agentPanel.composer.hover()
    await expect(agentPanel.assetPreview(ASSET_NAME)).toHaveCount(0)
    await agentPanel.composer.pressSequentially(' with motion')
    await expect(agentPanel.composer).toBeFocused()
    await agentPanel.composerAssetSection.focus()
    await agentPanel.composerAssetSection.press('Tab')
    const trigger = agentPanel.previewAssetButton(ASSET_NAME)
    await expect(trigger).toBeFocused()
    await trigger.press('Enter')
    const preview = agentPanel.assetPreview(ASSET_NAME)
    const player = preview.locator('video')
    await expect(preview).toBeVisible()
    await expect(player).toBeFocused()
    await expect(player).toHaveAttribute('controls', '')
    await expect(player).not.toHaveAttribute('autoplay')
    await expect(player).toHaveAttribute('poster', posterUrl)
    await expect
      .poll(() =>
        player.evaluate((video: HTMLVideoElement) => video.readyState)
      )
      .toBeGreaterThanOrEqual(2)
    await expect
      .poll(() => player.evaluate((video: HTMLVideoElement) => video.paused))
      .toBe(true)
    await player.press('Space')
    await expect
      .poll(() => player.evaluate((video: HTMLVideoElement) => video.paused))
      .toBe(false)
    await expect
      .poll(() =>
        player.evaluate((video: HTMLVideoElement) => video.currentTime)
      )
      .toBeGreaterThan(0)
    const playingElement = await player.elementHandle()
    assert(playingElement)
    await player.press('Escape')
    await expect(preview).toHaveCount(0)
    await expect(trigger).toBeFocused()
    await expect
      .poll(() =>
        playingElement.evaluate(
          (video) =>
            video instanceof HTMLVideoElement &&
            video.paused &&
            !video.isConnected
        )
      )
      .toBe(true)
    await playingElement.dispose()
    await trigger.press('Space')
    await expect(player).toBeVisible()
    await expect(player).toBeFocused()
    await expect
      .poll(() =>
        player.evaluate(
          (video: HTMLVideoElement) => video.paused && video.currentTime === 0
        )
      )
      .toBe(true)
    await player.press('Escape')
    await expect(preview).toHaveCount(0)
    await expect(agentPanel.composer).toContainText(' with motion')
  })

  test.describe('a short viewport', () => {
    test.use({ viewport: { width: 1024, height: 520 } })

    test('keeps the complete asset card visible as the prompt grows', async ({
      page
    }) => {
      const agentPanel = new AgentPanel(page)
      await agentPanel.open()
      const assets = new AssetsSidebarTab(page)
      await assets.open()
      await assets.assetCards.first().dragTo(agentPanel.root)
      await expect(agentPanel.attachmentChip(ASSET_NAME)).toBeVisible()
      await agentPanel.expectAttachmentFullyVisible(ASSET_NAME)
      const original = await agentPanel.attachmentChip(ASSET_NAME).boundingBox()
      assert(original)
      await agentPanel.composer.fill(
        'Keep this line and the attached video.\n'.repeat(40)
      )
      await agentPanel.expectAttachmentFullyVisible(ASSET_NAME)
      await expect
        .poll(
          async () =>
            (await agentPanel.attachmentChip(ASSET_NAME).boundingBox())?.height
        )
        .toBe(original.height)
      await expect(agentPanel.attachmentChips).toHaveCount(1)
      await expect(agentPanel.composer).toContainText(
        'Keep this line and the attached video.'
      )
    })
  })

  // A filename is user data and may contain a quote or a backslash, which would
  // break the attribute selector the chip is matched by. Exercised end to end
  // rather than unit-tested, so a regression in the escaping shows up as the
  // locator failing to find a chip that is plainly on screen.
  test.describe('a filename that is hostile to the selector', () => {
    // The quote and backslash are what actually break the quoted CSS string:
    // remove their escaping and this case fails. The \u0007 is carried too
    // because a filename may contain one, but measured honestly it does NOT
    // guard the escape's control-character branch - Chromium accepts a raw
    // control character inside a quoted attribute selector, so this case still
    // passes with that branch disabled. The branch stays for CSS-string
    // conformance, not because a test proves it.
    const AWKWARD_NAME = 'a "quoted" \\ name\u0007.mp4'
    const AWKWARD_ASSET = { ...AGENT_VIDEO_ASSET, name: AWKWARD_NAME }

    test.beforeEach(async ({ page, agentFlagEnabled }) => {
      await bootAgentApp(page, agentFlagEnabled, {
        assets: { assets: [AWKWARD_ASSET], total: 1, has_more: false }
      })
    })

    test('is still matched by the chip locator', async ({ page }) => {
      const agentPanel = new AgentPanel(page)
      await agentPanel.open()

      const assets = new AssetsSidebarTab(page)
      await assets.open()
      await assets.assetCards.first().dragTo(agentPanel.root)

      await expect(agentPanel.attachmentChip(AWKWARD_NAME)).toBeVisible()
    })
  })
})
