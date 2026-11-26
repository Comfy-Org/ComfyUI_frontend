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
      const box = await platformFrame.openBuildWizard()

      expect(box).toEqual({
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
        const box = await platformFrame.openBuildWizard()

        expect(box.width).toBeCloseTo(SIZE.maxWidth, 0)
        expect(box.height).toBeCloseTo(viewport.height - 2 * SIZE.margin, 0)
        expect(box.x).toBeCloseTo((viewport.width - SIZE.maxWidth) / 2, 0)
        expect(box.y).toBeCloseTo(SIZE.margin, 0)
      })
    })
  }

  test.describe('on a large screen', () => {
    test.use({ viewport: { width: 1920, height: 1200 } })

    test('caps at 1120 by 1024, centred', async ({ platformFrame }) => {
      const box = await platformFrame.openBuildWizard()

      expect(box.width).toBeCloseTo(SIZE.maxWidth, 0)
      expect(box.height).toBeCloseTo(SIZE.maxHeight, 0)
      expect(box.x).toBeCloseTo((1920 - SIZE.maxWidth) / 2, 0)
      expect(box.y).toBeCloseTo((1200 - SIZE.maxHeight) / 2, 0)
    })
  })

  test.describe('for the pre-install screen', () => {
    test.use({ viewport: { width: 1440, height: 900 } })

    test('keeps the smaller 720 by 520 dialog', async ({ platformFrame }) => {
      const box = await platformFrame.openPreinstall()

      expect(box.width).toBeCloseTo(SIZE.preinstallWidth, 0)
      expect(box.height).toBeCloseTo(SIZE.preinstallHeight, 0)
    })
  })
})
