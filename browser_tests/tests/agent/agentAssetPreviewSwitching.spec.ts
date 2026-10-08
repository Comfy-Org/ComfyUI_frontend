import assert from 'node:assert/strict'

import { expect } from '@playwright/test'

import {
  agentTest as test,
  bootAgentApp
} from '@e2e/fixtures/agentPanelFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { AssetsSidebarTab } from '@e2e/fixtures/components/SidebarTab'
import {
  AGENT_AUDIO_ASSET,
  AGENT_VIDEO_ASSET
} from '@e2e/fixtures/data/assetFixtures'
import { assetPath } from '@e2e/fixtures/utils/paths'

test.describe('Single asset tray preview', { tag: '@cloud' }, () => {
  test.beforeEach(async ({ page, agentFlagEnabled }) => {
    await page.route(
      `**/api/assets/${AGENT_AUDIO_ASSET.id}/content**`,
      (route) =>
        route.fulfill({
          path: assetPath('silence.wav'),
          contentType: 'audio/wav'
        })
    )
    await page.route(
      `**/api/assets/${AGENT_VIDEO_ASSET.id}/content**`,
      (route) =>
        route.fulfill({
          path: assetPath('plain_video.mp4'),
          contentType: 'video/mp4'
        })
    )
    await bootAgentApp(page, agentFlagEnabled, {
      assets: {
        assets: [AGENT_AUDIO_ASSET, AGENT_VIDEO_ASSET],
        total: 2,
        has_more: false
      }
    })
    const panel = new AgentPanel(page)
    await panel.open()
    const assets = new AssetsSidebarTab(page)
    await assets.open()
    await assets
      .getAssetCardByName('agent_generated_audio')
      .getByText('agent_generated_audio', { exact: true })
      .dragTo(panel.root)
    await expect(panel.attachmentChip(AGENT_AUDIO_ASSET.name)).toBeVisible()
    await assets
      .getAssetCardByName('agent_generated_video')
      .getByText('agent_generated_video', { exact: true })
      .dragTo(panel.root)
    await expect(panel.attachmentChips).toHaveCount(2)
    await panel.composer.fill('Keep this draft')
  })

  test('replaces a clicked preview on hover and preserves keyboard switching and dismissal', async ({
    page
  }) => {
    const panel = new AgentPanel(page)
    const audio = panel.previewAssetButton(AGENT_AUDIO_ASSET.name)
    const video = panel.previewAssetButton(AGENT_VIDEO_ASSET.name)
    await audio.click()
    await expect(panel.assetPreview(AGENT_AUDIO_ASSET.name)).toBeVisible()
    await video.hover()
    await expect(panel.assetPreview(AGENT_VIDEO_ASSET.name)).toBeVisible()
    await expect(panel.assetPreview(AGENT_AUDIO_ASSET.name)).toHaveCount(0)
    await expect(audio).toHaveAttribute('aria-expanded', 'false')
    await panel.composer.hover()
    await expect(panel.assetPreview(AGENT_VIDEO_ASSET.name)).toHaveCount(0)

    await audio.press('Enter')
    await expect(
      panel.assetPreview(AGENT_AUDIO_ASSET.name).locator('audio')
    ).toBeFocused()
    await video.press('Space')
    await expect(
      panel.assetPreview(AGENT_VIDEO_ASSET.name).locator('video')
    ).toBeFocused()
    await expect(panel.assetPreview(AGENT_AUDIO_ASSET.name)).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(panel.assetPreview(AGENT_VIDEO_ASSET.name)).toHaveCount(0)
    await expect(video).toBeFocused()
    await expect(panel.composer).toContainText('Keep this draft')
  })

  for (const { kind, asset, nextAsset } of [
    { kind: 'audio', asset: AGENT_AUDIO_ASSET, nextAsset: AGENT_VIDEO_ASSET },
    { kind: 'video', asset: AGENT_VIDEO_ASSET, nextAsset: AGENT_AUDIO_ASSET }
  ] as const) {
    test(`stops native ${kind} playback when hover replaces it and reopens paused`, async ({
      page
    }) => {
      const panel = new AgentPanel(page)
      const trigger = panel.previewAssetButton(asset.name)
      await trigger.click()
      const player = panel.assetPreview(asset.name).locator(kind)
      await expect(player).toBeFocused()
      await expect
        .poll(() =>
          player.evaluate((media: HTMLMediaElement) => media.readyState)
        )
        .toBeGreaterThanOrEqual(2)
      await player.press('Space')
      await expect
        .poll(() => player.evaluate((media: HTMLMediaElement) => media.paused))
        .toBe(false)
      const playing = await player.elementHandle()
      assert(playing)
      try {
        await panel.previewAssetButton(nextAsset.name).hover()
        await expect(panel.assetPreview(nextAsset.name)).toBeVisible()
        await expect
          .poll(() =>
            playing.evaluate(
              (media) =>
                media instanceof HTMLMediaElement &&
                media.paused &&
                media.currentTime === 0
            )
          )
          .toBe(true)
        await expect(panel.assetPreview(asset.name)).toHaveCount(0)
        await trigger.press('Enter')
        await expect(player).toBeFocused()
        await expect
          .poll(() =>
            player.evaluate(
              (media: HTMLMediaElement) =>
                media.paused && media.currentTime === 0
            )
          )
          .toBe(true)
        await expect(panel.assetPreview(nextAsset.name)).toHaveCount(0)
        await page.keyboard.press('Escape')
        await expect(trigger).toBeFocused()
        await expect(panel.assetPreview(asset.name)).toHaveCount(0)
      } finally {
        await playing.dispose()
      }
    })
  }
})
