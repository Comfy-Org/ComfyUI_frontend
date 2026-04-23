import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

test.describe('Image Compare', { tag: ['@widget', '@vue-nodes'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('widgets/image_compare_widget')
  })

  function createTestImageDataUrl(label: string, color: string): string {
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">` +
      `<rect width="200" height="200" fill="${color}"/>` +
      `<text x="50%" y="50%" fill="white" font-size="24" ` +
      `text-anchor="middle" dominant-baseline="middle">${label}</text></svg>`
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  }

  async function setImageCompareValue(
    comfyPage: ComfyPage,
    value: {
      beforeImages: string[]
      afterImages: string[]
      beforeAlt?: string
      afterAlt?: string
    }
  ) {
    await comfyPage.page.evaluate(
      ({ value }) => {
        const node = window.app!.graph.getNodeById(1)
        const widget = node?.widgets?.find((w) => w.type === 'imagecompare')
        if (widget) {
          widget.value = value
          widget.callback?.(value)
        }
      },
      { value }
    )
    await comfyPage.nextFrame()
  }

  async function moveToPercentage(
    page: Page,
    containerLocator: Locator,
    percentage: number
  ) {
    await expect
      .poll(async () => {
        const b = await containerLocator.boundingBox()
        return b !== null && b.width > 0 && b.height > 0
      })
      .toBe(true)
    const box = await containerLocator.boundingBox()
    if (!box || box.width <= 0 || box.height <= 0) {
      throw new Error('Slider move target has no layout box')
    }
    await page.mouse.move(
      box.x + box.width * (percentage / 100),
      box.y + box.height / 2
    )
  }

  async function waitForImagesLoaded(node: Locator) {
    await expect
      .poll(() =>
        node.evaluate((el) => {
          const imgs = el.querySelectorAll('img')
          return (
            imgs.length > 0 &&
            Array.from(imgs).every(
              (img) => img.complete && img.naturalWidth > 0
            )
          )
        })
      )
      .toBe(true)
  }

  async function getClipPathInsetRightPercent(imgLocator: Locator) {
    return imgLocator.evaluate((el) => {
      // Accessing raw style avoids cross-browser getComputedStyle normalization issues
      // Format is uniformly "inset(0 60% 0 0)" per Vue runtime inline style bindings
      const parts = (el as HTMLElement).style.clipPath.split(' ')
      return parts.length > 1 ? parseFloat(parts[1]) : -1
    })
  }

  test(
    'Shows empty state when no images are set',
    { tag: '@smoke' },
    async ({ comfyPage }) => {
      const node = comfyPage.vueNodes.getNodeLocator('1')
      await expect(node).toBeVisible()

      await expect(node.getByTestId(TestIds.imageCompare.empty)).toBeVisible()
      await expect(node.locator('img')).toHaveCount(0)
      await expect(node.getByRole('presentation')).toHaveCount(0)
    }
  )

  test(
    'Widget displays images and handle after value is set',
    { tag: '@smoke' },
    async ({ comfyPage }) => {
      const beforeUrl = createTestImageDataUrl('Before', '#c00')
      const afterUrl = createTestImageDataUrl('After', '#00c')
      await setImageCompareValue(comfyPage, {
        beforeImages: [beforeUrl],
        afterImages: [afterUrl]
      })

      const node = comfyPage.vueNodes.getNodeLocator('1')
      const beforeImg = node.locator('img[alt="Before image"]')
      const afterImg = node.locator('img[alt="After image"]')
      await expect(beforeImg).toBeVisible()
      await expect(afterImg).toBeVisible()
      await expect(node.getByRole('presentation')).toBeVisible()

      await waitForImagesLoaded(node)
    }
  )

  test(
    'Slider defaults to 50% with both images set',
    { tag: ['@smoke', '@screenshot'] },
    async ({ comfyPage }) => {
      const beforeUrl = createTestImageDataUrl('Before', '#c00')
      const afterUrl = createTestImageDataUrl('After', '#00c')
      await setImageCompareValue(comfyPage, {
        beforeImages: [beforeUrl],
        afterImages: [afterUrl]
      })

      const node = comfyPage.vueNodes.getNodeLocator('1')
      const beforeImg = node.locator('img[alt="Before image"]')
      const afterImg = node.locator('img[alt="After image"]')
      await expect(beforeImg).toBeVisible()
      await expect(afterImg).toBeVisible()

      const handle = node.getByRole('presentation')
      await expect(handle).toBeVisible()

      expect(
        await handle.evaluate((el) => (el as HTMLElement).style.left),
        'Slider should default to 50% before screenshot'
      ).toBe('50%')
      await expect
        .poll(() => getClipPathInsetRightPercent(beforeImg))
        .toBeCloseTo(50, 0)

      await waitForImagesLoaded(node)
      await comfyPage.page.mouse.move(0, 0)
      await expect(node).toHaveScreenshot('image-compare-default-50.png')
    }
  )

  test(
    'Mouse hover moves slider position',
    { tag: '@smoke' },
    async ({ comfyPage }) => {
      const beforeUrl = createTestImageDataUrl('Before', '#c00')
      const afterUrl = createTestImageDataUrl('After', '#00c')
      await setImageCompareValue(comfyPage, {
        beforeImages: [beforeUrl],
        afterImages: [afterUrl]
      })

      const node = comfyPage.vueNodes.getNodeLocator('1')
      const handle = node.getByRole('presentation')
      const beforeImg = node.locator('img[alt="Before image"]')
      const afterImg = node.locator('img[alt="After image"]')
      const viewport = node.getByTestId(TestIds.imageCompare.viewport)
      await expect(afterImg).toBeVisible()
      await expect(viewport).toBeVisible()

      // Left edge: sliderPosition ≈ 5 → clip-path inset right ≈ 95%
      await moveToPercentage(comfyPage.page, viewport, 5)
      await expect
        .poll(() => getClipPathInsetRightPercent(beforeImg))
        .toBeGreaterThan(90)
      await expect
        .poll(() =>
          handle.evaluate((el) => parseFloat((el as HTMLElement).style.left))
        )
        .toBeLessThan(10)

      // Right edge: sliderPosition ≈ 95 → clip-path inset right ≈ 5%
      await moveToPercentage(comfyPage.page, viewport, 95)
      await expect
        .poll(() => getClipPathInsetRightPercent(beforeImg))
        .toBeLessThan(10)
      await expect
        .poll(() =>
          handle.evaluate((el) => parseFloat((el as HTMLElement).style.left))
        )
        .toBeGreaterThan(90)
    }
  )

  test('Slider preserves last position when mouse leaves widget', async ({
    comfyPage
  }) => {
    const beforeUrl = createTestImageDataUrl('Before', '#c00')
    const afterUrl = createTestImageDataUrl('After', '#00c')
    await setImageCompareValue(comfyPage, {
      beforeImages: [beforeUrl],
      afterImages: [afterUrl]
    })

    const node = comfyPage.vueNodes.getNodeLocator('1')
    const handle = node.getByRole('presentation')
    const afterImg = node.locator('img[alt="After image"]')
    const viewport = node.getByTestId(TestIds.imageCompare.viewport)
    await expect(afterImg).toBeVisible()
    await expect(viewport).toBeVisible()

    await moveToPercentage(comfyPage.page, viewport, 30)
    // Wait for Vue to commit the slider update
    await expect
      .poll(() =>
        handle.evaluate((el) => parseFloat((el as HTMLElement).style.left))
      )
      .toBeCloseTo(30, 0)
    const positionWhileInside = parseFloat(
      await handle.evaluate((el) => (el as HTMLElement).style.left)
    )

    await comfyPage.page.mouse.move(0, 0)

    // Position must not reset to default 50%
    await expect
      .poll(() =>
        handle.evaluate((el) => parseFloat((el as HTMLElement).style.left))
      )
      .toBeCloseTo(positionWhileInside, 0)
  })

  test('Slider position clamps to 0-100% range at container edges', async ({
    comfyPage
  }) => {
    const beforeUrl = createTestImageDataUrl('Before', '#c00')
    const afterUrl = createTestImageDataUrl('After', '#00c')
    await setImageCompareValue(comfyPage, {
      beforeImages: [beforeUrl],
      afterImages: [afterUrl]
    })

    const node = comfyPage.vueNodes.getNodeLocator('1')
    const handle = node.getByRole('presentation')
    const compareArea = node.getByTestId(TestIds.imageCompare.viewport)
    await expect(compareArea).toBeVisible()

    await expect
      .poll(async () => {
        const b = await compareArea.boundingBox()
        return b !== null && b.width > 0 && b.height > 0
      })
      .toBe(true)

    const box = await compareArea.boundingBox()
    if (!box || box.width <= 0 || box.height <= 0) {
      throw new Error('Compare viewport layout not ready')
    }

    await comfyPage.page.mouse.move(box.x, box.y + box.height / 2)
    await expect
      .poll(() => handle.evaluate((el) => (el as HTMLElement).style.left))
      .toBe('0%')

    await comfyPage.page.mouse.move(
      box.x + box.width - 0.5,
      box.y + box.height / 2
    )
    await expect
      .poll(() =>
        handle.evaluate((el) => parseFloat((el as HTMLElement).style.left))
      )
      .toBeCloseTo(100, 0)
  })

  test('Only before image shows without slider when afterImages is empty', async ({
    comfyPage
  }) => {
    const url = createTestImageDataUrl('Before', '#c00')
    await setImageCompareValue(comfyPage, {
      beforeImages: [url],
      afterImages: []
    })

    const node = comfyPage.vueNodes.getNodeLocator('1')
    await expect(node.locator('img')).toHaveCount(1)
    await expect(node.getByRole('presentation')).toBeHidden()
  })

  test('Only after image shows without slider when beforeImages is empty', async ({
    comfyPage
  }) => {
    const url = createTestImageDataUrl('After', '#00c')
    await setImageCompareValue(comfyPage, {
      beforeImages: [],
      afterImages: [url]
    })

    const node = comfyPage.vueNodes.getNodeLocator('1')
    await expect(node.locator('img')).toHaveCount(1)
    await expect(node.getByRole('presentation')).toBeHidden()
  })

  test(
    'Batch navigation appears when before side has multiple images',
    { tag: '@smoke' },
    async ({ comfyPage }) => {
      const url1 = createTestImageDataUrl('A1', '#c00')
      const url2 = createTestImageDataUrl('A2', '#0c0')
      const url3 = createTestImageDataUrl('A3', '#00c')
      const afterUrl = createTestImageDataUrl('B1', '#888')
      await setImageCompareValue(comfyPage, {
        beforeImages: [url1, url2, url3],
        afterImages: [afterUrl]
      })

      const node = comfyPage.vueNodes.getNodeLocator('1')
      const beforeBatch = node.getByTestId(TestIds.imageCompare.beforeBatch)

      await expect(
        node.getByTestId(TestIds.imageCompare.batchNav)
      ).toBeVisible()
      await expect(
        beforeBatch.getByTestId(TestIds.imageCompare.batchCounter)
      ).toHaveText('1 / 3')
      // after-batch renders only when afterBatchCount > 1
      await expect(
        node.getByTestId(TestIds.imageCompare.afterBatch)
      ).toBeHidden()
      await expect(
        beforeBatch.getByTestId(TestIds.imageCompare.batchPrev)
      ).toBeDisabled()
    }
  )

  test('Batch navigation is hidden when both sides have single images', async ({
    comfyPage
  }) => {
    const url = createTestImageDataUrl('Image', '#c00')
    await setImageCompareValue(comfyPage, {
      beforeImages: [url],
      afterImages: [url]
    })

    const node = comfyPage.vueNodes.getNodeLocator('1')
    await expect(node.getByTestId(TestIds.imageCompare.batchNav)).toBeHidden()
  })

  test(
    'Navigate forward through before images',
    { tag: '@smoke' },
    async ({ comfyPage }) => {
      const url1 = createTestImageDataUrl('A1', '#c00')
      const url2 = createTestImageDataUrl('A2', '#0c0')
      const url3 = createTestImageDataUrl('A3', '#00c')
      await setImageCompareValue(comfyPage, {
        beforeImages: [url1, url2, url3],
        afterImages: [createTestImageDataUrl('B1', '#888')]
      })

      const node = comfyPage.vueNodes.getNodeLocator('1')
      const beforeBatch = node.getByTestId(TestIds.imageCompare.beforeBatch)
      const counter = beforeBatch.getByTestId(TestIds.imageCompare.batchCounter)
      const nextBtn = beforeBatch.getByTestId(TestIds.imageCompare.batchNext)
      const prevBtn = beforeBatch.getByTestId(TestIds.imageCompare.batchPrev)

      await nextBtn.click()
      await expect(counter).toHaveText('2 / 3')
      await expect(node.locator('img[alt="Before image"]')).toHaveAttribute(
        'src',
        url2
      )
      await expect(prevBtn).toBeEnabled()

      await nextBtn.click()
      await expect(counter).toHaveText('3 / 3')
      await expect(nextBtn).toBeDisabled()
    }
  )

  test('Navigate backward through before images', async ({ comfyPage }) => {
    const url1 = createTestImageDataUrl('A1', '#c00')
    const url2 = createTestImageDataUrl('A2', '#0c0')
    const url3 = createTestImageDataUrl('A3', '#00c')
    await setImageCompareValue(comfyPage, {
      beforeImages: [url1, url2, url3],
      afterImages: [createTestImageDataUrl('B1', '#888')]
    })

    const node = comfyPage.vueNodes.getNodeLocator('1')
    const beforeBatch = node.getByTestId(TestIds.imageCompare.beforeBatch)
    const counter = beforeBatch.getByTestId(TestIds.imageCompare.batchCounter)
    const nextBtn = beforeBatch.getByTestId(TestIds.imageCompare.batchNext)
    const prevBtn = beforeBatch.getByTestId(TestIds.imageCompare.batchPrev)

    await nextBtn.click()
    await nextBtn.click()
    await expect(counter).toHaveText('3 / 3')

    await prevBtn.click()
    await expect(counter).toHaveText('2 / 3')
    await expect(prevBtn).toBeEnabled()
    await expect(nextBtn).toBeEnabled()
  })

  test('Before and after batch navigation are independent', async ({
    comfyPage
  }) => {
    const url1 = createTestImageDataUrl('A1', '#c00')
    const url2 = createTestImageDataUrl('A2', '#0c0')
    const url3 = createTestImageDataUrl('A3', '#00c')
    const urlA = createTestImageDataUrl('B1', '#880')
    const urlB = createTestImageDataUrl('B2', '#008')
    await setImageCompareValue(comfyPage, {
      beforeImages: [url1, url2, url3],
      afterImages: [urlA, urlB]
    })

    const node = comfyPage.vueNodes.getNodeLocator('1')
    const beforeBatch = node.getByTestId(TestIds.imageCompare.beforeBatch)
    const afterBatch = node.getByTestId(TestIds.imageCompare.afterBatch)

    await beforeBatch.getByTestId(TestIds.imageCompare.batchNext).click()
    await afterBatch.getByTestId(TestIds.imageCompare.batchNext).click()

    await expect(
      beforeBatch.getByTestId(TestIds.imageCompare.batchCounter)
    ).toHaveText('2 / 3')
    await expect(
      afterBatch.getByTestId(TestIds.imageCompare.batchCounter)
    ).toHaveText('2 / 2')
    await expect(node.locator('img[alt="Before image"]')).toHaveAttribute(
      'src',
      url2
    )
    await expect(node.locator('img[alt="After image"]')).toHaveAttribute(
      'src',
      urlB
    )
  })

  test('ImageCompare node enforces minimum size', async ({ comfyPage }) => {
    const minWidth = 400
    const minHeight = 350
    const size = await comfyPage.page.evaluate(() => {
      const graphNode = window.app!.graph.getNodeById(1)
      if (!graphNode?.size) return null
      return { width: graphNode.size[0], height: graphNode.size[1] }
    })
    expect(
      size,
      'ImageCompare node id 1 must exist in loaded workflow graph'
    ).not.toBeNull()
    if (size === null) return
    expect(
      size.width,
      'ImageCompare node minimum width'
    ).toBeGreaterThanOrEqual(minWidth)
    expect(
      size.height,
      'ImageCompare node minimum height'
    ).toBeGreaterThanOrEqual(minHeight)
  })

  for (const { pct, expectedClipMin, expectedClipMax } of [
    { pct: 25, expectedClipMin: 70, expectedClipMax: 80 },
    { pct: 75, expectedClipMin: 20, expectedClipMax: 30 }
  ]) {
    test(
      `Screenshot at ${pct}% slider position`,
      { tag: '@screenshot' },
      async ({ comfyPage }) => {
        const beforeUrl = createTestImageDataUrl('Before', '#c00')
        const afterUrl = createTestImageDataUrl('After', '#00c')
        await setImageCompareValue(comfyPage, {
          beforeImages: [beforeUrl],
          afterImages: [afterUrl]
        })

        const node = comfyPage.vueNodes.getNodeLocator('1')
        const beforeImg = node.locator('img[alt="Before image"]')
        const viewport = node.getByTestId(TestIds.imageCompare.viewport)
        await waitForImagesLoaded(node)
        await expect(viewport).toBeVisible()
        await moveToPercentage(comfyPage.page, viewport, pct)
        await expect
          .poll(() => getClipPathInsetRightPercent(beforeImg))
          .toBeGreaterThan(expectedClipMin)
        await expect
          .poll(() => getClipPathInsetRightPercent(beforeImg))
          .toBeLessThan(expectedClipMax)

        await expect(node).toHaveScreenshot(`image-compare-slider-${pct}.png`)
      }
    )
  }

  test('Widget handles image load failure gracefully', async ({
    comfyPage
  }) => {
    const brokenBefore = 'http://127.0.0.1:1/broken.png'
    const brokenAfter = 'http://127.0.0.1:1/broken2.png'

    const pageErrors: Error[] = []
    const onPageError = (err: Error) => {
      pageErrors.push(err)
    }
    comfyPage.page.on('pageerror', onPageError)

    try {
      await setImageCompareValue(comfyPage, {
        beforeImages: [brokenBefore],
        afterImages: [brokenAfter]
      })

      const node = comfyPage.vueNodes.getNodeLocator('1')
      await expect.soft(node, 'ImageCompare node stays on canvas').toBeVisible()
      await expect
        .soft(node.locator('img'), 'Broken URLs still render img elements')
        .toHaveCount(2)
      await expect
        .soft(
          node.getByRole('presentation'),
          'Compare slider remains for failed network loads'
        )
        .toBeVisible()

      await expect
        .poll(() =>
          node.evaluate((el) => {
            const imgs = el.querySelectorAll('img')
            let errors = 0
            imgs.forEach((img) => {
              if (img.complete && img.naturalWidth === 0 && img.src) errors++
            })
            return errors
          })
        )
        .toBe(2)

      expect(
        pageErrors,
        'Image load failures must not surface as uncaught page errors'
      ).toHaveLength(0)
    } finally {
      comfyPage.page.off('pageerror', onPageError)
    }
  })

  test('Rapid value updates show latest images and reset batch index', async ({
    comfyPage
  }) => {
    const redUrl = createTestImageDataUrl('Red', '#c00')
    const green1Url = createTestImageDataUrl('G1', '#0c0')
    const green2Url = createTestImageDataUrl('G2', '#090')
    const blueUrl = createTestImageDataUrl('Blue', '#00c')

    await setImageCompareValue(comfyPage, {
      beforeImages: [redUrl, green1Url],
      afterImages: [blueUrl]
    })

    const node = comfyPage.vueNodes.getNodeLocator('1')
    await node
      .getByTestId(TestIds.imageCompare.beforeBatch)
      .getByTestId(TestIds.imageCompare.batchNext)
      .click()
    await expect(
      node
        .getByTestId(TestIds.imageCompare.beforeBatch)
        .getByTestId(TestIds.imageCompare.batchCounter)
    ).toHaveText('2 / 2')

    await setImageCompareValue(comfyPage, {
      beforeImages: [green1Url, green2Url],
      afterImages: [blueUrl]
    })

    await expect(node.locator('img[alt="Before image"]')).toHaveAttribute(
      'src',
      green1Url
    )
    await expect(
      node
        .getByTestId(TestIds.imageCompare.beforeBatch)
        .getByTestId(TestIds.imageCompare.batchCounter)
    ).toHaveText('1 / 2')
  })

  test('Legacy string value shows single image without slider', async ({
    comfyPage
  }) => {
    const url = createTestImageDataUrl('Legacy', '#c00')
    await comfyPage.page.evaluate(
      ({ url }) => {
        const node = window.app!.graph.getNodeById(1)
        const widget = node?.widgets?.find((w) => w.type === 'imagecompare')
        if (widget) {
          widget.value = url
          widget.callback?.(url)
        }
      },
      { url }
    )
    await comfyPage.nextFrame()

    const node = comfyPage.vueNodes.getNodeLocator('1')
    await expect(node.locator('img')).toHaveCount(1)
    await expect(node.getByRole('presentation')).toBeHidden()
  })

  test('Custom beforeAlt and afterAlt are used as img alt text', async ({
    comfyPage
  }) => {
    const beforeUrl = createTestImageDataUrl('Before', '#c00')
    const afterUrl = createTestImageDataUrl('After', '#00c')
    await setImageCompareValue(comfyPage, {
      beforeImages: [beforeUrl],
      afterImages: [afterUrl],
      beforeAlt: 'Custom before',
      afterAlt: 'Custom after'
    })

    const node = comfyPage.vueNodes.getNodeLocator('1')
    await expect(node.locator('img[alt="Custom before"]')).toBeVisible()
    await expect(node.locator('img[alt="Custom after"]')).toBeVisible()
  })

  test('Large batch sizes show correct counter and end navigation state', async ({
    comfyPage
  }) => {
    const images = Array.from({ length: 20 }, (_, i) =>
      createTestImageDataUrl(String(i + 1), '#c00')
    )
    await setImageCompareValue(comfyPage, {
      beforeImages: images,
      afterImages: images
    })

    const node = comfyPage.vueNodes.getNodeLocator('1')
    const beforeBatch = node.getByTestId(TestIds.imageCompare.beforeBatch)
    const afterBatch = node.getByTestId(TestIds.imageCompare.afterBatch)

    await expect(
      beforeBatch.getByTestId(TestIds.imageCompare.batchCounter)
    ).toHaveText('1 / 20')
    await expect(
      afterBatch.getByTestId(TestIds.imageCompare.batchCounter)
    ).toHaveText('1 / 20')

    const beforeNext = beforeBatch.getByTestId(TestIds.imageCompare.batchNext)
    const afterNext = afterBatch.getByTestId(TestIds.imageCompare.batchNext)
    for (let i = 0; i < 19; i++) {
      await beforeNext.click()
      await afterNext.click()
    }

    await expect(
      beforeBatch.getByTestId(TestIds.imageCompare.batchCounter)
    ).toHaveText('20 / 20')
    await expect(
      afterBatch.getByTestId(TestIds.imageCompare.batchCounter)
    ).toHaveText('20 / 20')
    await expect(
      beforeBatch.getByTestId(TestIds.imageCompare.batchPrev)
    ).toBeEnabled()
    await expect(
      afterBatch.getByTestId(TestIds.imageCompare.batchPrev)
    ).toBeEnabled()
    await expect(beforeNext).toBeDisabled()
    await expect(afterNext).toBeDisabled()
  })
})
