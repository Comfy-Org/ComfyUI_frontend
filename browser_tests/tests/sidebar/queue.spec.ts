import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../../fixtures/ComfyPage'

test.describe.skip('Queue sidebar', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.UseNewMenu', 'Top')
  })

  test('can display tasks', async ({ comfyPage }) => {
    await comfyPage.setupHistory().withTask(['example.webp']).setupRoutes()
    await comfyPage.menu.queueTab.open()
    await comfyPage.menu.queueTab.waitForTasks()
    expect(await comfyPage.menu.queueTab.visibleTasks.count()).toBe(1)
  })

  test('can display tasks after closing then opening', async ({
    comfyPage
  }) => {
    await comfyPage.setupHistory().withTask(['example.webp']).setupRoutes()
    await comfyPage.menu.queueTab.open()
    await comfyPage.menu.queueTab.close()
    await comfyPage.menu.queueTab.open()
    await comfyPage.menu.queueTab.waitForTasks()
    expect(await comfyPage.menu.queueTab.visibleTasks.count()).toBe(1)
  })

  test.describe('Virtual scroll', () => {
    const layouts = [
      { description: 'Five columns layout', width: 95, rows: 3, cols: 5 },
      { description: 'Three columns layout', width: 55, rows: 3, cols: 3 },
      { description: 'Two columns layout', width: 40, rows: 3, cols: 2 }
    ]

    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage
        .setupHistory()
        .withTask(['example.webp'])
        .repeat(50)
        .setupRoutes()
    })

    layouts.forEach(({ description, width, rows, cols }) => {
      const preRenderedRows = 1
      const preRenderedTasks = preRenderedRows * cols * 2
      const visibleTasks = rows * cols
      const expectRenderLimit = visibleTasks + preRenderedTasks

      test.describe(description, () => {
        test.beforeEach(async ({ comfyPage }) => {
          await comfyPage.menu.queueTab.setTabWidth(width)
          await comfyPage.menu.queueTab.open()
          await comfyPage.menu.queueTab.waitForTasks()
        })

        test('should not render items outside of view', async ({
          comfyPage
        }) => {
          const renderedCount =
            await comfyPage.menu.queueTab.visibleTasks.count()
          expect(renderedCount).toBeLessThanOrEqual(expectRenderLimit)
        })

        test('should teardown items after scrolling away', async ({
          comfyPage
        }) => {
          await comfyPage.menu.queueTab.scrollTasks('down')
          const renderedCount =
            await comfyPage.menu.queueTab.visibleTasks.count()
          expect(renderedCount).toBeLessThanOrEqual(expectRenderLimit)
        })

        test('should re-render items after scrolling away then back', async ({
          comfyPage
        }) => {
          await comfyPage.menu.queueTab.scrollTasks('down')
          await comfyPage.menu.queueTab.scrollTasks('up')
          const renderedCount =
            await comfyPage.menu.queueTab.visibleTasks.count()
          expect(renderedCount).toBeLessThanOrEqual(expectRenderLimit)
        })
      })
    })
  })

  test.describe('Expand tasks', () => {
    test.beforeEach(async ({ comfyPage }) => {
      // 2-item batch and 3-item batch -> 3 additional items when expanded
      await comfyPage
        .setupHistory()
        .withTask(['example.webp', 'example.webp', 'example.webp'])
        .withTask(['example.webp', 'example.webp'])
        .setupRoutes()
      await comfyPage.menu.queueTab.open()
      await comfyPage.menu.queueTab.waitForTasks()
    })

    test('can expand tasks with multiple outputs', async ({ comfyPage }) => {
      const initialCount = await comfyPage.menu.queueTab.visibleTasks.count()
      await comfyPage.menu.queueTab.expandTasks()
      expect(await comfyPage.menu.queueTab.visibleTasks.count()).toBe(
        initialCount + 3
      )
    })

    test('can collapse flat tasks', async ({ comfyPage }) => {
      const initialCount = await comfyPage.menu.queueTab.visibleTasks.count()
      await comfyPage.menu.queueTab.expandTasks()
      await comfyPage.menu.queueTab.collapseTasks()
      expect(await comfyPage.menu.queueTab.visibleTasks.count()).toBe(
        initialCount
      )
    })
  })

  test.describe('Clear tasks', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage
        .setupHistory()
        .withTask(['example.webp'])
        .repeat(6)
        .setupRoutes()
      await comfyPage.menu.queueTab.open()
    })

    test('can clear all tasks', async ({ comfyPage }) => {
      await comfyPage.menu.queueTab.clearTasks()
      expect(await comfyPage.menu.queueTab.visibleTasks.count()).toBe(0)
      expect(
        await comfyPage.menu.queueTab.noResultsPlaceholder.isVisible()
      ).toBe(true)
    })

    test('can load new tasks after clearing all', async ({ comfyPage }) => {
      await comfyPage.menu.queueTab.clearTasks()
      await comfyPage.menu.queueTab.close()
      await comfyPage.setupHistory().withTask(['example.webp']).setupRoutes()
      await comfyPage.menu.queueTab.open()
      await comfyPage.menu.queueTab.waitForTasks()
      expect(await comfyPage.menu.queueTab.visibleTasks.count()).toBe(1)
    })
  })

  test.describe('Gallery', () => {
    const firstImage = 'example.webp'
    const secondImage = 'image32x32.webp'

    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage
        .setupHistory()
        .withTask([secondImage])
        .withTask([firstImage])
        .setupRoutes()
      await comfyPage.menu.queueTab.open()
      await comfyPage.menu.queueTab.waitForTasks()
      await comfyPage.menu.queueTab.openTaskPreview(0)
    })

    test('displays gallery image after opening task preview', async ({
      comfyPage
    }) => {
      await comfyPage.nextFrame()
      expect(comfyPage.menu.queueTab.getGalleryImage(firstImage)).toBeVisible()
    })

    test('maintains active gallery item when new tasks are added', async ({
      comfyPage
    }) => {
      // Add a new task while the gallery is still open
      const newImage = 'image64x64.webp'
      comfyPage.setupHistory().withTask([newImage])
      await comfyPage.menu.queueTab.triggerTasksUpdate()
      await comfyPage.page.waitForTimeout(500)
      const newTask = comfyPage.menu.queueTab.tasks.getByAltText(newImage)
      await newTask.waitFor({ state: 'visible' })
      // The active gallery item should still be the initial image
      expect(comfyPage.menu.queueTab.getGalleryImage(firstImage)).toBeVisible()
    })

    test.describe('Gallery navigation', () => {
      const paths: {
        description: string
        path: ('Right' | 'Left')[]
        end: string
      }[] = [
        { description: 'Right', path: ['Right'], end: secondImage },
        { description: 'Left', path: ['Right', 'Left'], end: firstImage },
        { description: 'Left wrap', path: ['Left'], end: secondImage },
        { description: 'Right wrap', path: ['Right', 'Right'], end: firstImage }
      ]

      paths.forEach(({ description, path, end }) => {
        test(`can navigate gallery ${description}`, async ({ comfyPage }) => {
          for (const direction of path)
            await comfyPage.page.keyboard.press(`Arrow${direction}`, {
              delay: 256
            })
          await comfyPage.nextFrame()
          expect(comfyPage.menu.queueTab.getGalleryImage(end)).toBeVisible()
        })
      })
    })
  })
})
