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

test.describe('Asset preview playback', { tag: '@cloud' }, () => {
  for (const { kind, asset, file, contentType } of [
    {
      kind: 'video',
      asset: AGENT_VIDEO_ASSET,
      file: 'plain_video.mp4',
      contentType: 'video/mp4'
    },
    {
      kind: 'audio',
      asset: AGENT_AUDIO_ASSET,
      file: 'silence.wav',
      contentType: 'audio/wav'
    }
  ] as const) {
    test(`stops ${kind} at close and reopens paused during the exit animation`, async ({
      page,
      agentFlagEnabled
    }) => {
      await page.route(`**/api/assets/${asset.id}/content**`, (route) =>
        route.fulfill({ path: assetPath(file), contentType })
      )
      await bootAgentApp(page, agentFlagEnabled, {
        assets: { assets: [asset], total: 1, has_more: false }
      })
      const panel = new AgentPanel(page)
      await panel.open()
      const assets = new AssetsSidebarTab(page)
      await assets.open()
      await assets.assetCards.first().dragTo(panel.root)
      await panel.composer.fill('Keep this draft')
      const trigger = panel.previewAssetButton(asset.name)
      await trigger.press('Enter')
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
      const playingElement = await player.elementHandle()
      assert(playingElement)
      try {
        await page.keyboard.press('Escape')
        expect(
          await playingElement.evaluate(
            (media) => media instanceof HTMLMediaElement && media.paused
          )
        ).toBe(true)
        await page.keyboard.press('Enter')
        await expect(trigger).toHaveAttribute('aria-expanded', 'true')
        await expect(player).toBeFocused()
        await expect
          .poll(() =>
            player.evaluate(
              (media: HTMLMediaElement) =>
                media.paused && media.currentTime === 0
            )
          )
          .toBe(true)
        await player.press('Space')
        await expect
          .poll(() =>
            player.evaluate((media: HTMLMediaElement) => media.paused)
          )
          .toBe(false)
        const reopenedElement = await player.elementHandle()
        assert(reopenedElement)
        try {
          await panel.composer.click()
          expect(
            await reopenedElement.evaluate(
              (media) => media instanceof HTMLMediaElement && media.paused
            )
          ).toBe(true)
        } finally {
          await reopenedElement.dispose()
        }
        await expect(trigger).toHaveAttribute('aria-expanded', 'false')
        await expect(panel.composer).toBeFocused()
        await expect(panel.composer).toContainText('Keep this draft')
      } finally {
        await playingElement.dispose()
      }
    })
  }
})
