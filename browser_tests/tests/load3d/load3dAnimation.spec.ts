import { expect } from '@playwright/test'

import { assetPath } from '@e2e/fixtures/utils/paths'
import { load3dTest as test } from '@e2e/fixtures/helpers/Load3DFixtures'

test.describe('Load3D animation controls', { tag: '@vue-nodes' }, () => {
  test(
    'Animation controls render in their own row between the viewport and the bottom bar',
    { tag: '@smoke' },
    async ({ comfyPage, load3d }) => {
      const uploadResponsePromise = comfyPage.page.waitForResponse(
        (resp) => resp.url().includes('/upload/') && resp.status() === 200,
        { timeout: 15000 }
      )
      const fileChooserPromise = comfyPage.page.waitForEvent('filechooser')
      await load3d.getUploadButton('upload 3d model').click()
      const fileChooser = await fileChooserPromise
      await fileChooser.setFiles(assetPath('animated_triangle.glb'))
      await uploadResponsePromise
      await load3d.waitForModelLoaded()

      await expect(load3d.playAnimationButton).toBeVisible()
      await load3d.animationClipButton.click()
      await expect(load3d.getAnimationClipMenuItem('spin')).toBeVisible()
      await load3d.getAnimationClipMenuItem('spin').click()

      const [play, topBar, bottomBar, viewport] = await Promise.all([
        load3d.playAnimationButton.boundingBox(),
        load3d.menuButton.boundingBox(),
        load3d.recordingButton.boundingBox(),
        load3d.canvas.boundingBox()
      ])
      expect(play).not.toBeNull()
      expect(topBar).not.toBeNull()
      expect(bottomBar).not.toBeNull()
      expect(viewport).not.toBeNull()

      expect(play!.y).toBeGreaterThanOrEqual(topBar!.y + topBar!.height)
      expect(play!.y).toBeGreaterThanOrEqual(viewport!.y + viewport!.height)
      expect(play!.y + play!.height).toBeLessThanOrEqual(bottomBar!.y)

      await load3d.playAnimationButton.click()
      await expect(load3d.pauseAnimationButton).toBeVisible()
    }
  )
})
