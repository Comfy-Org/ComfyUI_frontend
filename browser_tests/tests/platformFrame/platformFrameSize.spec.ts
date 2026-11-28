import { expect } from '@playwright/test'

import {
  PLATFORM_FRAME_SIZE as SIZE,
  platformFrameTest as test
} from '@e2e/fixtures/platformFrameFixture'

test.describe('Platform frame dialog size', { tag: '@cloud' }, () => {
  test.describe.configure({ timeout: 120_000 })

  test.describe('on a narrow screen', () => {
    test.use({ viewport: { width: 1024, height: 700 } })

    test('fills the screen less a 24px margin on every side', async ({
      platformFrame
    }) => {
      await platformFrame.openBuildWizard()

      await expect
        .poll(() => platformFrame.dialogBox())
        .toEqual({
          x: SIZE.margin,
          y: SIZE.margin,
          width: 1024 - 2 * SIZE.margin,
          height: 700 - 2 * SIZE.margin
        })
    })
  })

  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 1440, height: 900 }
  ]) {
    test.describe(`on a ${viewport.width}x${viewport.height} laptop`, () => {
      test.use({ viewport })

      test('caps at 1120 wide and leaves 24px above and below', async ({
        platformFrame
      }) => {
        await platformFrame.openBuildWizard()

        await expect
          .poll(() => platformFrame.dialogBox())
          .toEqual({
            x: (viewport.width - SIZE.maxWidth) / 2,
            y: SIZE.margin,
            width: SIZE.maxWidth,
            height: viewport.height - 2 * SIZE.margin
          })
      })
    })
  }

  test.describe('on a large screen', () => {
    test.use({ viewport: { width: 1920, height: 1200 } })

    test('caps at 1120 by 1024, centred', async ({ platformFrame }) => {
      await platformFrame.openBuildWizard()

      await expect
        .poll(() => platformFrame.dialogBox())
        .toEqual({
          x: (1920 - SIZE.maxWidth) / 2,
          y: (1200 - SIZE.maxHeight) / 2,
          width: SIZE.maxWidth,
          height: SIZE.maxHeight
        })
    })
  })

  test.describe('for the pre-install screen', () => {
    test.use({ viewport: { width: 1440, height: 900 } })

    test('keeps the smaller 720 by 520 dialog', async ({ platformFrame }) => {
      await platformFrame.openPreinstall()

      await expect
        .poll(() => platformFrame.dialogBox())
        .toMatchObject({
          width: SIZE.preinstallWidth,
          height: SIZE.preinstallHeight
        })
    })
  })
})
