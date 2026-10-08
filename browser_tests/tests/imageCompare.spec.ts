import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import { toNodeId } from '@/types/nodeId'

const IMAGE_COMPARE_NODE_ID = toNodeId(1)

function testImage(label: string, color: string): string {
  return `${label}.${color.replace('#', '')}.png`
}

function testImageSvg(filename: string): string {
  const [label, color] = filename.split('.')
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">` +
    `<rect width="200" height="200" fill="#${color}"/>` +
    `<text x="50%" y="50%" fill="white" font-size="24" ` +
    `text-anchor="middle" dominant-baseline="middle">${label}</text></svg>`
  )
}

test.describe('Image Compare', { tag: ['@widget', '@vue-nodes'] }, () => {
  test.beforeEach(async ({ page, comfyPage }) => {
    await page.route(
      (url) => url.pathname.endsWith('/view'),
      async (route, request) => {
        const filename =
          new URL(request.url()).searchParams.get('filename') ?? ''
        if (filename.startsWith('broken')) {
          await route.abort()
          return
        }
        await route.fulfill({
          contentType: 'image/svg+xml',
          body: testImageSvg(filename)
        })
      }
    )
    await comfyPage.workflow.loadWorkflow('widgets/image_compare_widget')
  })

  async function setSavedImages(
    comfyPage: ComfyPage,
    images: { beforeImages: string[]; afterImages: string[] }
  ) {
    await comfyPage.page.evaluate(
      ({ nodeId, beforeImages, afterImages }) => {
        const toResultItems = (filenames: string[]) =>
          filenames.map((filename) => ({
            filename,
            subfolder: '',
            type: 'temp' as const
          }))
        window.app!.nodeOutputs[String(nodeId)] = {
          a_images: toResultItems(beforeImages),
          b_images: toResultItems(afterImages)
        }
      },
      {
        nodeId: IMAGE_COMPARE_NODE_ID,
        beforeImages: images.beforeImages,
        afterImages: images.afterImages
      }
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

  function srcOf(filename: string) {
    return new RegExp(`filename=${filename.replace(/\./g, '\\.')}`)
  }

  test(
    'Shows empty state when the node is unconnected and has not run',
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
    'Widget displays images and handle after a run saves them',
    { tag: '@smoke' },
    async ({ comfyPage }) => {
      await setSavedImages(comfyPage, {
        beforeImages: [testImage('Before', '#c00')],
        afterImages: [testImage('After', '#00c')]
      })

      const node = comfyPage.vueNodes.getNodeLocator('1')
      await expect(node.locator('img[alt="Before image"]')).toBeVisible()
      await expect(node.locator('img[alt="After image"]')).toBeVisible()
      await expect(node.getByRole('presentation')).toBeVisible()

      await waitForImagesLoaded(node)
    }
  )

  test.describe('Workflow tab switching', () => {
    test.use({
      initialSettings: { 'Comfy.Workflow.WorkflowTabsPosition': 'Sidebar' }
    })

    test('Comparison survives a workflow tab switch', async ({ comfyPage }) => {
      test.info().annotations.push({
        type: 'regression',
        description:
          'Compare images lived on the non-serialized widget value, so switching tabs emptied the widget'
      })

      const tab = comfyPage.menu.workflowsTab
      await tab.open()
      await comfyPage.menu.topbar.saveWorkflow('image-compare-tab-switch')

      await setSavedImages(comfyPage, {
        beforeImages: [testImage('Before', '#c00')],
        afterImages: [testImage('After', '#00c')]
      })
      await comfyPage.page.evaluate(() => {
        window.app!.extensionManager.workflow.activeWorkflow?.changeTracker.captureCanvasState()
      })

      const node = comfyPage.vueNodes.getNodeLocator('1')
      await expect(node.locator('img')).toHaveCount(2)

      await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
      await comfyPage.workflow.waitForWorkflowIdle()

      await expect(tab.getOpenedItem('image-compare-tab-switch')).toBeVisible()
      await tab.switchToWorkflow('image-compare-tab-switch')
      await comfyPage.workflow.waitForWorkflowIdle()

      const restored = comfyPage.vueNodes.getNodeLocator('1')
      await expect(restored.locator('img[alt="Before image"]')).toHaveAttribute(
        'src',
        srcOf(testImage('Before', '#c00'))
      )
      await expect(restored.locator('img[alt="After image"]')).toHaveAttribute(
        'src',
        srcOf(testImage('After', '#00c'))
      )
    })
  })

  test(
    'Slider defaults to 50% with both images set',
    { tag: ['@smoke', '@screenshot'] },
    async ({ comfyPage }) => {
      await setSavedImages(comfyPage, {
        beforeImages: [testImage('Before', '#c00')],
        afterImages: [testImage('After', '#00c')]
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
      await setSavedImages(comfyPage, {
        beforeImages: [testImage('Before', '#c00')],
        afterImages: [testImage('After', '#00c')]
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
    await setSavedImages(comfyPage, {
      beforeImages: [testImage('Before', '#c00')],
      afterImages: [testImage('After', '#00c')]
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
    await setSavedImages(comfyPage, {
      beforeImages: [testImage('Before', '#c00')],
      afterImages: [testImage('After', '#00c')]
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

  test('Only before image shows without slider when the after side is empty', async ({
    comfyPage
  }) => {
    await setSavedImages(comfyPage, {
      beforeImages: [testImage('Before', '#c00')],
      afterImages: []
    })

    const node = comfyPage.vueNodes.getNodeLocator('1')
    await expect(node.locator('img')).toHaveCount(1)
    await expect(node.getByRole('presentation')).toBeHidden()
  })

  test('Only after image shows without slider when the before side is empty', async ({
    comfyPage
  }) => {
    await setSavedImages(comfyPage, {
      beforeImages: [],
      afterImages: [testImage('After', '#00c')]
    })

    const node = comfyPage.vueNodes.getNodeLocator('1')
    await expect(node.locator('img')).toHaveCount(1)
    await expect(node.getByRole('presentation')).toBeHidden()
  })

  test(
    'Batch navigation appears when before side has multiple images',
    { tag: '@smoke' },
    async ({ comfyPage }) => {
      await setSavedImages(comfyPage, {
        beforeImages: [
          testImage('A1', '#c00'),
          testImage('A2', '#0c0'),
          testImage('A3', '#00c')
        ],
        afterImages: [testImage('B1', '#888')]
      })

      const node = comfyPage.vueNodes.getNodeLocator('1')
      const beforeBatch = node.getByTestId(TestIds.imageCompare.beforeBatch)

      await expect(
        node.getByTestId(TestIds.imageCompare.batchNav)
      ).toBeVisible()
      await expect(
        beforeBatch.getByTestId(TestIds.imageCompare.batchCounter)
      ).toHaveText('1 / 3')
      // after-batch renders only when the after side has more than one image
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
    await setSavedImages(comfyPage, {
      beforeImages: [testImage('Image', '#c00')],
      afterImages: [testImage('Image', '#c00')]
    })

    const node = comfyPage.vueNodes.getNodeLocator('1')
    await expect(node.getByTestId(TestIds.imageCompare.batchNav)).toBeHidden()
  })

  test(
    'Navigate forward through before images',
    { tag: '@smoke' },
    async ({ comfyPage }) => {
      await setSavedImages(comfyPage, {
        beforeImages: [
          testImage('A1', '#c00'),
          testImage('A2', '#0c0'),
          testImage('A3', '#00c')
        ],
        afterImages: [testImage('B1', '#888')]
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
        srcOf(testImage('A2', '#0c0'))
      )
      await expect(prevBtn).toBeEnabled()

      await nextBtn.click()
      await expect(counter).toHaveText('3 / 3')
      await expect(nextBtn).toBeDisabled()
    }
  )

  test('Navigate backward through before images', async ({ comfyPage }) => {
    await setSavedImages(comfyPage, {
      beforeImages: [
        testImage('A1', '#c00'),
        testImage('A2', '#0c0'),
        testImage('A3', '#00c')
      ],
      afterImages: [testImage('B1', '#888')]
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
    await setSavedImages(comfyPage, {
      beforeImages: [
        testImage('A1', '#c00'),
        testImage('A2', '#0c0'),
        testImage('A3', '#00c')
      ],
      afterImages: [testImage('B1', '#880'), testImage('B2', '#008')]
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
      srcOf(testImage('A2', '#0c0'))
    )
    await expect(node.locator('img[alt="After image"]')).toHaveAttribute(
      'src',
      srcOf(testImage('B2', '#008'))
    )
  })

  test('ImageCompare node enforces minimum size', async ({ comfyPage }) => {
    const minWidth = 400
    const minHeight = 350
    const size = await comfyPage.page.evaluate((nodeId) => {
      const graphNode = window.app!.graph.getNodeById(nodeId)
      if (!graphNode?.size) return null
      return { width: graphNode.size[0], height: graphNode.size[1] }
    }, IMAGE_COMPARE_NODE_ID)
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
        await setSavedImages(comfyPage, {
          beforeImages: [testImage('Before', '#c00')],
          afterImages: [testImage('After', '#00c')]
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
    const pageErrors: Error[] = []
    const onPageError = (err: Error) => {
      pageErrors.push(err)
    }
    comfyPage.page.on('pageerror', onPageError)

    try {
      await setSavedImages(comfyPage, {
        beforeImages: ['broken-before.png'],
        afterImages: ['broken-after.png']
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

  test('A newer run with fewer images returns to the first image', async ({
    comfyPage
  }) => {
    await setSavedImages(comfyPage, {
      beforeImages: [testImage('Red', '#c00'), testImage('G1', '#0c0')],
      afterImages: [testImage('Blue', '#00c')]
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

    await setSavedImages(comfyPage, {
      beforeImages: [testImage('G2', '#090')],
      afterImages: [testImage('Blue', '#00c')]
    })

    await expect(node.locator('img[alt="Before image"]')).toHaveAttribute(
      'src',
      srcOf(testImage('G2', '#090'))
    )
    await expect(node.getByTestId(TestIds.imageCompare.batchNav)).toBeHidden()
  })

  test('Large batch sizes show correct counter and end navigation state', async ({
    comfyPage
  }) => {
    const images = Array.from({ length: 20 }, (_, i) =>
      testImage(String(i + 1), '#c00')
    )
    await setSavedImages(comfyPage, {
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
