import type { Locator } from '@playwright/test'

import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'

type CropValue = { x: number; y: number; width: number; height: number } | null

const POINTER_OPTS = { bubbles: true, cancelable: true, pointerId: 1 } as const
const MIN_CROP_SIZE = 16

async function getCropValue(
  comfyPage: ComfyPage,
  nodeId: number
): Promise<CropValue> {
  return comfyPage.page.evaluate((id) => {
    const n = window.app!.graph.getNodeById(id)
    const w = n?.widgets?.find((x) => x.type === 'imagecrop')
    const v = w?.value
    if (v && typeof v === 'object' && 'x' in v) {
      const crop = v as {
        x: number
        y: number
        width: number
        height: number
      }
      return {
        x: crop.x,
        y: crop.y,
        width: crop.width,
        height: crop.height
      }
    }
    return null
  }, nodeId)
}

async function setCropBounds(
  comfyPage: ComfyPage,
  nodeId: number,
  bounds: { x: number; y: number; width: number; height: number }
) {
  await comfyPage.page.evaluate(
    ({ id, b }) => {
      const n = window.app!.graph.getNodeById(id)
      const w = n?.widgets?.find((x) => x.type === 'imagecrop')
      if (w) {
        w.value = { ...b }
        w.callback?.(b)
      }
    },
    { id: nodeId, b: bounds }
  )
  await comfyPage.nextFrame()
  await comfyPage.nextFrame()
}

async function waitForImageNaturalSize(
  img: Locator,
  options?: { timeout?: number }
) {
  await expect
    .poll(
      () =>
        img.evaluate(
          (el: HTMLImageElement) => el.naturalWidth > 0 && el.naturalHeight > 0
        ),
      {
        message: 'image naturalWidth and naturalHeight should be ready',
        ...(options?.timeout != null ? { timeout: options.timeout } : {})
      }
    )
    .toBe(true)
}

async function dragOnLocator(
  comfyPage: ComfyPage,
  target: Locator,
  deltaClientX: number,
  deltaClientY: number
) {
  await expect
    .poll(
      async () => {
        const b = await target.boundingBox()
        return b !== null && b.width > 0 && b.height > 0
      },
      { message: 'drag target should have a laid-out bounding box' }
    )
    .toBe(true)
  const box = await target.boundingBox()
  if (!box) throw new Error('drag target has no bounding box')
  const x0 = box.x + box.width / 2
  const y0 = box.y + box.height / 2
  await target.dispatchEvent('pointerdown', {
    ...POINTER_OPTS,
    clientX: x0,
    clientY: y0
  })
  await comfyPage.nextFrame()
  await target.dispatchEvent('pointermove', {
    ...POINTER_OPTS,
    clientX: x0 + deltaClientX,
    clientY: y0 + deltaClientY
  })
  await comfyPage.nextFrame()
  await target.dispatchEvent('pointerup', {
    ...POINTER_OPTS,
    clientX: x0 + deltaClientX,
    clientY: y0 + deltaClientY
  })
  await comfyPage.nextFrame()
}

test.describe('Image Crop', { tag: ['@widget', '@vue-nodes'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
  })

  test.describe('without source image', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('widgets/image_crop_widget')
    })

    test(
      'Shows empty state when no input image is connected',
      { tag: '@smoke' },
      async ({ comfyPage }) => {
        const node = comfyPage.vueNodes.getNodeLocator('1')
        await expect(node, 'image crop node should render').toBeVisible()

        await expect
          .soft(node.getByTestId('crop-empty-icon'), 'empty state icon')
          .toBeVisible()
        await expect
          .soft(node, 'empty state copy')
          .toContainText('No input image connected')
        await expect
          .soft(node.getByTestId('crop-overlay'), 'no overlay without image')
          .toHaveCount(0)
        await expect.soft(node.locator('img'), 'no preview img').toHaveCount(0)
        await expect
          .soft(node.getByTestId('crop-resize-right'), 'no resize handles')
          .toHaveCount(0)
      }
    )

    test(
      'Renders controls in default state',
      { tag: '@smoke' },
      async ({ comfyPage }) => {
        const node = comfyPage.vueNodes.getNodeLocator('1')
        await expect(node, 'image crop node should render').toBeVisible()

        await expect(node.getByText('Ratio'), 'ratio label').toBeVisible()
        await expect(
          node.locator('button:has(.icon-\\[lucide--lock-open\\])'),
          'ratio unlock button'
        ).toBeVisible()
        await expect(
          node.locator('input'),
          'bounding box numeric inputs'
        ).toHaveCount(4)
      }
    )

    test(
      'Empty state matches screenshot baseline',
      { tag: '@screenshot' },
      async ({ comfyPage }) => {
        const node = comfyPage.vueNodes.getNodeLocator('1')
        await expect(node, 'image crop node should render').toBeVisible()
        await comfyPage.nextFrame()
        await comfyPage.nextFrame()
        await expect(node).toHaveScreenshot('image-crop-empty-state.png', {
          maxDiffPixelRatio: 0.05
        })
      }
    )

    test('Pointer drag on empty state does not change crop widget value', async ({
      comfyPage
    }) => {
      const node = comfyPage.vueNodes.getNodeLocator('1')
      const before = await getCropValue(comfyPage, 1)
      expect(before, 'Fixture should define imagecrop bounds').not.toBeNull()

      const empty = node.getByTestId('crop-empty-state')
      await dragOnLocator(comfyPage, empty, 40, 30)

      await expect
        .poll(() => getCropValue(comfyPage, 1), {
          message: 'empty-state drag should not mutate crop value'
        })
        .toStrictEqual(before)
    })
  })

  test.describe(
    'with source image after execution',
    { tag: ['@widget', '@slow'] },
    () => {
      test.beforeEach(async ({ comfyPage }) => {
        await comfyPage.workflow.loadWorkflow('widgets/image_crop_with_source')
        await comfyPage.runButton.click()
        await expect(
          comfyPage.vueNodes.getNodeLocator('2').locator('img'),
          'source image preview should appear after run'
        ).toBeVisible({ timeout: 30_000 })
      })

      test(
        'Displays source image with crop overlay after execution',
        { tag: ['@smoke', '@screenshot'] },
        async ({ comfyPage }) => {
          const node = comfyPage.vueNodes.getNodeLocator('2')
          const img = node.locator('img')

          await waitForImageNaturalSize(img)

          await expect(
            node.getByTestId('crop-overlay'),
            'crop overlay should show when image is ready'
          ).toBeVisible()
          await expect(
            node
              .locator('[data-testid^="crop-resize-"]')
              .filter({ visible: true }),
            'unlocked ratio should expose eight handles'
          ).toHaveCount(8)

          await comfyPage.nextFrame()
          await comfyPage.nextFrame()
          await expect(node).toHaveScreenshot('image-crop-with-source.png', {
            maxDiffPixelRatio: 0.05
          })
        }
      )

      test(
        'Drag crop box updates crop position',
        { tag: ['@smoke', '@screenshot'] },
        async ({ comfyPage }) => {
          const node = comfyPage.vueNodes.getNodeLocator('2')
          const cropBox = node.getByTestId('crop-overlay')
          await expect
            .poll(
              async () => {
                const b = await cropBox.boundingBox()
                return b !== null && b.width > 0 && b.height > 0 ? b : null
              },
              { message: 'crop overlay should have a stable bounding box' }
            )
            .not.toBeNull()
          const box = await cropBox.boundingBox()
          if (!box) throw new Error('Crop box not found')

          const valueBefore = await getCropValue(comfyPage, 2)
          if (!valueBefore)
            throw new Error('Widget value missing — check fixture setup')

          const startX = box.x + box.width / 2
          const startY = box.y + box.height / 2

          await cropBox.dispatchEvent('pointerdown', {
            ...POINTER_OPTS,
            clientX: startX,
            clientY: startY
          })
          await comfyPage.nextFrame()
          await cropBox.dispatchEvent('pointermove', {
            ...POINTER_OPTS,
            clientX: startX + 15,
            clientY: startY + 10
          })
          await comfyPage.nextFrame()
          await cropBox.dispatchEvent('pointermove', {
            ...POINTER_OPTS,
            clientX: startX + 30,
            clientY: startY + 20
          })
          await cropBox.dispatchEvent('pointerup', {
            ...POINTER_OPTS,
            clientX: startX + 30,
            clientY: startY + 20
          })
          await comfyPage.nextFrame()

          await expect
            .poll(
              async () => {
                const v = await getCropValue(comfyPage, 2)
                if (
                  !v ||
                  v.x <= valueBefore.x ||
                  v.y <= valueBefore.y ||
                  v.width !== valueBefore.width ||
                  v.height !== valueBefore.height
                ) {
                  return null
                }
                return v
              },
              {
                timeout: 5000,
                message: 'crop drag should increase x/y without changing size'
              }
            )
            .not.toBeNull()

          await expect(node).toHaveScreenshot('image-crop-after-drag.png', {
            maxDiffPixelRatio: 0.05
          })
        }
      )

      test('Drag clamps crop box to the right and bottom image edge', async ({
        comfyPage
      }) => {
        const node = comfyPage.vueNodes.getNodeLocator('2')
        const img = node.locator('img')
        await waitForImageNaturalSize(img)
        const { nw, nh } = await img.evaluate((el: HTMLImageElement) => ({
          nw: el.naturalWidth,
          nh: el.naturalHeight
        }))

        await setCropBounds(comfyPage, 2, {
          x: nw - 100,
          y: nh - 90,
          width: 70,
          height: 70
        })

        const cropBox = node.getByTestId('crop-overlay')
        await dragOnLocator(comfyPage, cropBox, 400, 200)

        await expect
          .poll(
            async () => {
              const v = await getCropValue(comfyPage, 2)
              return v ? v.x + v.width : 0
            },
            { message: 'crop drag should clamp to image right edge' }
          )
          .toBeLessThanOrEqual(nw)

        await expect
          .poll(
            async () => {
              const v = await getCropValue(comfyPage, 2)
              return v ? v.y + v.height : 0
            },
            { message: 'crop drag should clamp to image bottom edge' }
          )
          .toBeLessThanOrEqual(nh)
      })

      test('Drag clamps crop box to the top-left image corner', async ({
        comfyPage
      }) => {
        await setCropBounds(comfyPage, 2, {
          x: 8,
          y: 8,
          width: 120,
          height: 100
        })

        const cropBox = comfyPage.vueNodes
          .getNodeLocator('2')
          .getByTestId('crop-overlay')
        await dragOnLocator(comfyPage, cropBox, -400, -350)

        await expect
          .poll(async () => (await getCropValue(comfyPage, 2))?.x ?? -1, {
            message: 'crop drag should clamp x to the image'
          })
          .toBeGreaterThanOrEqual(0)
        await expect
          .poll(async () => (await getCropValue(comfyPage, 2))?.y ?? -1, {
            message: 'crop drag should clamp y to the image'
          })
          .toBeGreaterThanOrEqual(0)
      })

      test('Resize from right edge increases width only', async ({
        comfyPage
      }) => {
        const node = comfyPage.vueNodes.getNodeLocator('2')
        await setCropBounds(comfyPage, 2, {
          x: 40,
          y: 40,
          width: 160,
          height: 120
        })

        const before = await getCropValue(comfyPage, 2)
        if (!before) throw new Error('missing crop')

        const handle = node.getByTestId('crop-resize-right')
        await dragOnLocator(comfyPage, handle, 55, 0)

        await expect
          .poll(
            async () => {
              const v = await getCropValue(comfyPage, 2)
              if (!v) return false
              return (
                v.width > before.width &&
                v.x === before.x &&
                v.y === before.y &&
                v.height === before.height
              )
            },
            { message: 'right-edge resize should grow width only' }
          )
          .toBe(true)
      })

      test('Resize from left edge decreases x and increases width', async ({
        comfyPage
      }) => {
        const node = comfyPage.vueNodes.getNodeLocator('2')
        await setCropBounds(comfyPage, 2, {
          x: 200,
          y: 100,
          width: 300,
          height: 200
        })

        const before = await getCropValue(comfyPage, 2)
        if (!before) throw new Error('missing crop')

        await dragOnLocator(
          comfyPage,
          node.getByTestId('crop-resize-left'),
          -50,
          0
        )

        await expect
          .poll(
            async () => {
              const v = await getCropValue(comfyPage, 2)
              if (!v) return false
              return (
                v.x < before.x &&
                v.width > before.width &&
                v.y === before.y &&
                v.height === before.height
              )
            },
            { message: 'left-edge resize should move x and grow width only' }
          )
          .toBe(true)
      })

      test('Resize from bottom edge increases height only', async ({
        comfyPage
      }) => {
        const node = comfyPage.vueNodes.getNodeLocator('2')
        await setCropBounds(comfyPage, 2, {
          x: 50,
          y: 50,
          width: 140,
          height: 110
        })

        const before = await getCropValue(comfyPage, 2)
        if (!before) throw new Error('missing crop')

        await dragOnLocator(
          comfyPage,
          node.getByTestId('crop-resize-bottom'),
          0,
          50
        )

        await expect
          .poll(
            async () => {
              const v = await getCropValue(comfyPage, 2)
              if (!v) return false
              return (
                v.height > before.height &&
                v.x === before.x &&
                v.y === before.y &&
                v.width === before.width
              )
            },
            { message: 'bottom-edge resize should grow height only' }
          )
          .toBe(true)
      })

      test('Resize from top edge decreases y and increases height', async ({
        comfyPage
      }) => {
        const node = comfyPage.vueNodes.getNodeLocator('2')
        await setCropBounds(comfyPage, 2, {
          x: 60,
          y: 120,
          width: 160,
          height: 140
        })

        const before = await getCropValue(comfyPage, 2)
        if (!before) throw new Error('missing crop')

        await dragOnLocator(
          comfyPage,
          node.getByTestId('crop-resize-top'),
          0,
          -45
        )

        await expect
          .poll(
            async () => {
              const v = await getCropValue(comfyPage, 2)
              if (!v) return false
              return (
                v.y < before.y &&
                v.height > before.height &&
                v.x === before.x &&
                v.width === before.width
              )
            },
            { message: 'top-edge resize should move y and grow height only' }
          )
          .toBe(true)
      })

      test(
        'Resize from SE corner increases width and height',
        { tag: '@screenshot' },
        async ({ comfyPage }) => {
          const node = comfyPage.vueNodes.getNodeLocator('2')
          await setCropBounds(comfyPage, 2, {
            x: 70,
            y: 80,
            width: 130,
            height: 110
          })

          const before = await getCropValue(comfyPage, 2)
          if (!before) throw new Error('missing crop')

          await dragOnLocator(
            comfyPage,
            node.getByTestId('crop-resize-se'),
            40,
            35
          )

          await expect
            .poll(
              async () => {
                const v = await getCropValue(comfyPage, 2)
                if (!v) return false
                return (
                  v.width > before.width &&
                  v.height > before.height &&
                  v.x === before.x &&
                  v.y === before.y
                )
              },
              { message: 'SE corner resize should grow width and height' }
            )
            .toBe(true)

          await comfyPage.nextFrame()
          await comfyPage.nextFrame()
          await expect(node).toHaveScreenshot('image-crop-resize-se.png', {
            maxDiffPixelRatio: 0.05
          })
        }
      )

      test(
        'Resize from NW corner moves top-left and grows box',
        { tag: '@screenshot' },
        async ({ comfyPage }) => {
          const node = comfyPage.vueNodes.getNodeLocator('2')
          await setCropBounds(comfyPage, 2, {
            x: 140,
            y: 130,
            width: 160,
            height: 140
          })

          const before = await getCropValue(comfyPage, 2)
          if (!before) throw new Error('missing crop')

          await dragOnLocator(
            comfyPage,
            node.getByTestId('crop-resize-nw'),
            -45,
            -40
          )

          await expect
            .poll(
              async () => {
                const v = await getCropValue(comfyPage, 2)
                if (!v) return false
                return (
                  v.x < before.x &&
                  v.y < before.y &&
                  v.width > before.width &&
                  v.height > before.height
                )
              },
              { message: 'NW corner resize should move origin and grow box' }
            )
            .toBe(true)

          await comfyPage.nextFrame()
          await comfyPage.nextFrame()
          await expect(node).toHaveScreenshot('image-crop-resize-nw.png', {
            maxDiffPixelRatio: 0.05
          })
        }
      )

      test('Resize enforces minimum crop dimensions', async ({ comfyPage }) => {
        const node = comfyPage.vueNodes.getNodeLocator('2')
        await setCropBounds(comfyPage, 2, {
          x: 80,
          y: 80,
          width: 50,
          height: 50
        })

        await dragOnLocator(
          comfyPage,
          node.getByTestId('crop-resize-right'),
          -200,
          0
        )

        await expect
          .poll(async () => (await getCropValue(comfyPage, 2))?.width ?? 0, {
            message: 'crop width should respect minimum size'
          })
          .toBeGreaterThanOrEqual(MIN_CROP_SIZE)
        await expect
          .poll(async () => (await getCropValue(comfyPage, 2))?.height ?? 0, {
            message: 'crop height should respect minimum size'
          })
          .toBeGreaterThanOrEqual(MIN_CROP_SIZE)
      })

      test('Resize clamps to image boundaries on the right and bottom edges', async ({
        comfyPage
      }) => {
        const node = comfyPage.vueNodes.getNodeLocator('2')
        const img = node.locator('img')
        await waitForImageNaturalSize(img)
        const { nw, nh } = await img.evaluate((el: HTMLImageElement) => ({
          nw: el.naturalWidth,
          nh: el.naturalHeight
        }))

        await setCropBounds(comfyPage, 2, {
          x: nw - 120,
          y: 40,
          width: 80,
          height: 90
        })

        await dragOnLocator(
          comfyPage,
          node.getByTestId('crop-resize-right'),
          400,
          0
        )

        await expect
          .poll(
            async () => {
              const v = await getCropValue(comfyPage, 2)
              return v ? v.x + v.width : 0
            },
            { message: 'right-edge resize should not extend past image width' }
          )
          .toBeLessThanOrEqual(nw)

        await dragOnLocator(
          comfyPage,
          node.getByTestId('crop-resize-bottom'),
          0,
          400
        )

        await expect
          .poll(
            async () => {
              const v = await getCropValue(comfyPage, 2)
              return v ? v.y + v.height : 0
            },
            {
              message: 'bottom-edge resize should not extend past image height'
            }
          )
          .toBeLessThanOrEqual(nh)
      })

      test(
        'Eight resize handles are visible when ratio is unlocked',
        { tag: '@screenshot' },
        async ({ comfyPage }) => {
          const node = comfyPage.vueNodes.getNodeLocator('2')
          await expect(
            node
              .locator('[data-testid^="crop-resize-"]')
              .filter({ visible: true }),
            'unlocked ratio should expose edge and corner handles'
          ).toHaveCount(8)

          await comfyPage.nextFrame()
          await comfyPage.nextFrame()
          await expect(node).toHaveScreenshot('image-crop-eight-handles.png', {
            maxDiffPixelRatio: 0.05
          })
        }
      )

      test('Four corner resize handles are visible when aspect ratio is locked', async ({
        comfyPage
      }) => {
        const node = comfyPage.vueNodes.getNodeLocator('2')
        await node.getByRole('button', { name: 'Lock aspect ratio' }).click()
        await expect(
          node
            .locator('[data-testid^="crop-resize-"]')
            .filter({ visible: true }),
          'locked ratio should only show corner handles'
        ).toHaveCount(4)
      })

      test('Resize with locked aspect ratio keeps width and height proportional', async ({
        comfyPage
      }) => {
        const node = comfyPage.vueNodes.getNodeLocator('2')
        await setCropBounds(comfyPage, 2, {
          x: 70,
          y: 80,
          width: 160,
          height: 120
        })
        await node.getByRole('button', { name: 'Lock aspect ratio' }).click()

        const before = await getCropValue(comfyPage, 2)
        if (!before) throw new Error('missing crop')

        const ratio = before.width / before.height

        await dragOnLocator(
          comfyPage,
          node.getByTestId('crop-resize-se'),
          48,
          36
        )

        await expect
          .poll(
            async () => {
              const v = await getCropValue(comfyPage, 2)
              if (!v || v.width <= before.width || v.height <= before.height) {
                return null
              }
              const r = v.width / v.height
              if (Math.abs(r - ratio) > 0.06) return null
              return v
            },
            { message: 'locked ratio resize should preserve aspect ratio' }
          )
          .not.toBeNull()
      })

      test('Broken image URL resets widget to empty state', async ({
        comfyPage
      }) => {
        const node = comfyPage.vueNodes.getNodeLocator('2')
        const img = node.locator('img')
        await waitForImageNaturalSize(img)

        let failExamplePng = false
        await comfyPage.page.route('**/api/view**', async (route) => {
          const u = route.request().url()
          if (failExamplePng && u.includes('example.png')) {
            await route.abort('failed')
            return
          }
          await route.continue()
        })
        try {
          failExamplePng = true
          const runDone = comfyPage.runButton.click()
          await expect(
            node.getByTestId('crop-empty-state'),
            'failed view fetch should show empty state'
          ).toBeVisible({ timeout: 15_000 })
          await expect(
            node.getByTestId('crop-overlay'),
            'crop overlay should hide when image fails'
          ).toHaveCount(0)
          await runDone
        } finally {
          await comfyPage.page.unroute('**/api/view**')
        }
      })
    }
  )

  test.describe(
    'with source image (slow view)',
    { tag: ['@widget', '@slow'] },
    () => {
      test('Shows loading text while the view image is delayed', async ({
        comfyPage
      }) => {
        // Slow only example.png view fetches — simulates network latency for the
        // loading overlay. Delay lives in the route handler (not
        // page.waitForTimeout in the test body).
        await comfyPage.page.route('**/api/view**', async (route) => {
          const url = route.request().url()
          if (!url.includes('example.png')) {
            await route.continue()
            return
          }
          await new Promise<void>((resolve) => {
            setTimeout(resolve, 500)
          })
          await route.continue()
        })

        try {
          await comfyPage.workflow.loadWorkflow(
            'widgets/image_crop_with_source'
          )
          await comfyPage.vueNodes.waitForNodes()
          const node = comfyPage.vueNodes.getNodeLocator('2')
          const runDone = comfyPage.runButton.click()
          await expect(
            node.getByText('Loading...'),
            'delayed view should show loading overlay'
          ).toBeVisible({ timeout: 10_000 })
          await runDone

          const img = node.locator('img')
          await waitForImageNaturalSize(img, { timeout: 30_000 })

          await expect(
            node.getByText('Loading...'),
            'loading overlay should hide after delayed image loads'
          ).toBeHidden()
        } finally {
          await comfyPage.page.unroute('**/api/view**')
        }
      })
    }
  )
})
