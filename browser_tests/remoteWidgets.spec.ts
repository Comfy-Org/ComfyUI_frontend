import { expect } from '@playwright/test'

import { ComfyPage, comfyPageFixture as test } from './fixtures/ComfyPage'

test.describe('Remote COMBO Widget', () => {
  const mockOptions = ['d', 'c', 'b', 'a']

  const addRemoteWidgetNode = async (
    comfyPage: ComfyPage,
    nodeName: string,
    count: number = 1
  ) => {
    const tab = comfyPage.menu.nodeLibraryTab
    await tab.open()
    await tab.getFolder('DevTools').click()
    const nodeEntry = tab.getNode(nodeName).first()
    for (let i = 0; i < count; i++) {
      await nodeEntry.click()
      await comfyPage.nextFrame()
    }
  }

  const getWidgetOptions = async (
    comfyPage: ComfyPage,
    nodeName: string
  ): Promise<string[] | undefined> => {
    return await comfyPage.page.evaluate((name) => {
      const node = window['app'].graph.nodes.find((node) => node.title === name)
      return node.widgets[0].options.values
    }, nodeName)
  }

  const getWidgetValue = async (comfyPage: ComfyPage, nodeName: string) => {
    return await comfyPage.page.evaluate((name) => {
      const node = window['app'].graph.nodes.find((node) => node.title === name)
      return node.widgets[0].value
    }, nodeName)
  }

  const clickRefreshButton = (comfyPage: ComfyPage, nodeName: string) => {
    return comfyPage.page.evaluate((name) => {
      const node = window['app'].graph.nodes.find((node) => node.title === name)
      const buttonWidget = node.widgets.find((w) => w.name === 'refresh')
      return buttonWidget?.callback()
    }, nodeName)
  }

  const waitForWidgetUpdate = async (comfyPage: ComfyPage) => {
    // Force re-render to trigger first access of widget's options
    await comfyPage.page.mouse.click(400, 300)
    await comfyPage.page.waitForTimeout(256)
  }

  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.UseNewMenu', 'Top')
  })

  test.describe('Loading options', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.setSetting('Comfy.UseNewMenu', 'Top')
      await comfyPage.page.route(
        '**/api/models/checkpoints**',
        async (route, request) => {
          const params = new URL(request.url()).searchParams
          const sort = params.get('sort')
          await route.fulfill({
            body: JSON.stringify(sort ? [...mockOptions].sort() : mockOptions),
            status: 200
          })
        }
      )
    })

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.page.unroute('**/api/models/checkpoints**')
    })

    test('lazy loads options when widget is added from node library', async ({
      comfyPage
    }) => {
      const nodeName = 'Remote Widget Node'
      await addRemoteWidgetNode(comfyPage, nodeName)
      await waitForWidgetUpdate(comfyPage)
      const widgetOptions = await getWidgetOptions(comfyPage, nodeName)
      expect(widgetOptions).toEqual(mockOptions)
    })

    test('lazy loads options when widget is added via workflow load', async ({
      comfyPage
    }) => {
      const nodeName = 'Remote Widget Node'
      await comfyPage.loadWorkflow('remote_widget')
      await comfyPage.page.waitForTimeout(512)

      const node = await comfyPage.page.evaluate((name) => {
        return window['app'].graph.nodes.find((node) => node.title === name)
      }, nodeName)
      expect(node).toBeDefined()

      await waitForWidgetUpdate(comfyPage)
      const widgetOptions = await getWidgetOptions(comfyPage, nodeName)
      expect(widgetOptions).toEqual(mockOptions)
    })

    test('applies query parameters from input spec', async ({ comfyPage }) => {
      const nodeName = 'Remote Widget Node With Sort Query Param'
      await addRemoteWidgetNode(comfyPage, nodeName)
      await waitForWidgetUpdate(comfyPage)
      const widgetOptions = await getWidgetOptions(comfyPage, nodeName)
      expect(widgetOptions).not.toEqual(mockOptions)
      expect(widgetOptions).toEqual([...mockOptions].sort())
    })

    test('handles empty list of options', async ({ comfyPage }) => {
      await comfyPage.page.route(
        '**/api/models/checkpoints**',
        async (route) => {
          await route.fulfill({ body: JSON.stringify([]), status: 200 })
        }
      )

      const nodeName = 'Remote Widget Node'
      await addRemoteWidgetNode(comfyPage, nodeName)
      await waitForWidgetUpdate(comfyPage)
      const widgetOptions = await getWidgetOptions(comfyPage, nodeName)
      expect(widgetOptions).toEqual([])
    })

    test('falls back to default value when non-200 response', async ({
      comfyPage
    }) => {
      await comfyPage.page.route(
        '**/api/models/checkpoints**',
        async (route) => {
          await route.fulfill({ status: 500 })
        }
      )

      const nodeName = 'Remote Widget Node'
      await addRemoteWidgetNode(comfyPage, nodeName)
      await waitForWidgetUpdate(comfyPage)
      const widgetOptions = await getWidgetOptions(comfyPage, nodeName)

      const defaultValue = 'Loading...'
      expect(widgetOptions).toEqual(defaultValue)
    })
  })

  test.describe('Lazy Loading Behavior', () => {
    test('does not fetch options before widget is added to graph', async ({
      comfyPage
    }) => {
      let requestWasMade = false

      comfyPage.page.on('request', (request) => {
        if (request.url().includes('/api/models/checkpoints')) {
          requestWasMade = true
        }
      })

      // Wait a reasonable time to ensure no request is made
      await comfyPage.page.waitForTimeout(512)
      expect(requestWasMade).toBe(false)
    })

    test('fetches options immediately after widget is added to graph', async ({
      comfyPage
    }) => {
      const requestPromise = comfyPage.page.waitForRequest((request) =>
        request.url().includes('/api/models/checkpoints')
      )
      await addRemoteWidgetNode(comfyPage, 'Remote Widget Node')
      const request = await requestPromise
      expect(request.url()).toContain('/api/models/checkpoints')
    })
  })

  test.describe('Refresh Behavior', () => {
    test('refreshes options when TTL expires', async ({ comfyPage }) => {
      // Fulfill each request with a unique timestamp
      await comfyPage.page.route(
        '**/api/models/checkpoints**',
        async (route, request) => {
          await route.fulfill({
            body: JSON.stringify([Date.now()]),
            status: 200
          })
        }
      )

      const nodeName = 'Remote Widget Node With 300ms Refresh'
      await addRemoteWidgetNode(comfyPage, nodeName)
      await waitForWidgetUpdate(comfyPage)
      const initialOptions = await getWidgetOptions(comfyPage, nodeName)

      // Wait for the refresh (TTL) to expire
      await comfyPage.page.waitForTimeout(512)
      await comfyPage.page.mouse.click(100, 100)

      const refreshedOptions = await getWidgetOptions(comfyPage, nodeName)
      expect(refreshedOptions).not.toEqual(initialOptions)
    })

    test('does not refresh when TTL is not set', async ({ comfyPage }) => {
      let requestCount = 0
      await comfyPage.page.route(
        '**/api/models/checkpoints**',
        async (route) => {
          requestCount++
          await route.fulfill({ body: JSON.stringify(['test']), status: 200 })
        }
      )

      const nodeName = 'Remote Widget Node'
      await addRemoteWidgetNode(comfyPage, nodeName)
      await waitForWidgetUpdate(comfyPage)

      // Force multiple re-renders
      for (let i = 0; i < 3; i++) {
        await comfyPage.page.mouse.click(100, 100)
        await comfyPage.nextFrame()
      }

      expect(requestCount).toBe(1) // Should only make initial request
    })

    test('retries failed requests with backoff', async ({ comfyPage }) => {
      const timestamps: number[] = []
      await comfyPage.page.route(
        '**/api/models/checkpoints**',
        async (route) => {
          timestamps.push(Date.now())
          await route.fulfill({ status: 500 })
        }
      )

      const nodeName = 'Remote Widget Node'
      await addRemoteWidgetNode(comfyPage, nodeName)
      await waitForWidgetUpdate(comfyPage)

      // Wait for timeout and backoff, then force re-render, repeat
      const requestTimeout = 512
      await comfyPage.page.waitForTimeout(requestTimeout)
      await waitForWidgetUpdate(comfyPage)
      await comfyPage.page.waitForTimeout(requestTimeout * 2)
      await waitForWidgetUpdate(comfyPage)
      await comfyPage.page.waitForTimeout(requestTimeout * 3)

      // Verify exponential backoff between retries
      const intervals = timestamps.slice(1).map((t, i) => t - timestamps[i])
      expect(intervals[1]).toBeGreaterThan(intervals[0])
    })

    test('clicking refresh button forces a refresh', async ({ comfyPage }) => {
      await comfyPage.page.route(
        '**/api/models/checkpoints**',
        async (route) => {
          await route.fulfill({
            body: JSON.stringify([`${Date.now()}`]),
            status: 200
          })
        }
      )

      const nodeName = 'Remote Widget Node With Refresh Button'

      // Trigger initial fetch when adding node to the graph
      await addRemoteWidgetNode(comfyPage, nodeName)
      await waitForWidgetUpdate(comfyPage)
      const initialOptions = await getWidgetOptions(comfyPage, nodeName)

      // Click refresh button
      await clickRefreshButton(comfyPage, nodeName)

      // Verify refresh occurred
      const refreshedOptions = await getWidgetOptions(comfyPage, nodeName)
      expect(refreshedOptions).not.toEqual(initialOptions)
    })

    test('control_after_refresh is applied after refresh', async ({
      comfyPage
    }) => {
      const options = [
        ['first option', 'second option', 'third option'],
        ['new first option', 'first option', 'second option', 'third option']
      ]
      await comfyPage.page.route(
        '**/api/models/checkpoints**',
        async (route) => {
          const next = options.shift()
          await route.fulfill({
            body: JSON.stringify(next),
            status: 200
          })
        }
      )

      const nodeName =
        'Remote Widget Node With Refresh Button and Control After Refresh'

      // Trigger initial fetch when adding node to the graph
      await addRemoteWidgetNode(comfyPage, nodeName)
      await waitForWidgetUpdate(comfyPage)

      // Click refresh button
      await clickRefreshButton(comfyPage, nodeName)

      // Verify the selected value of the widget is the first option in the refreshed list
      const refreshedValue = await getWidgetValue(comfyPage, nodeName)
      expect(refreshedValue).toEqual('new first option')
    })
  })

  test.describe('Cache Behavior', () => {
    test('reuses cached data between widgets with same params', async ({
      comfyPage
    }) => {
      let requestCount = 0
      await comfyPage.page.route(
        '**/api/models/checkpoints**',
        async (route) => {
          requestCount++
          await route.fulfill({
            body: JSON.stringify(mockOptions),
            status: 200
          })
        }
      )

      // Add two widgets with same config
      const nodeName = 'Remote Widget Node'
      await addRemoteWidgetNode(comfyPage, nodeName, 2)
      await waitForWidgetUpdate(comfyPage)

      expect(requestCount).toBe(1) // Should reuse cached data
    })
  })
})
