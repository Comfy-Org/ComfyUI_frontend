import { expect } from '@playwright/test'
import { comfyPageFixture as test } from './fixtures/ComfyPage'
import { LocationMock } from './helpers/locationMock'

test.describe('Location Mock Example', () => {
  test('should mock location object', async ({ page, comfyPage }) => {
    const locationMock = new LocationMock(page)

    // Setup location mock before navigating to the page
    await locationMock.setupLocationMock({
      href: 'http://example.com/test',
      pathname: '/test',
      search: '?query=value',
      hash: '#section'
    })

    // Navigate to your app
    await comfyPage.goto()

    // Verify the mock is working
    const location = await locationMock.getLocation()
    expect(location.pathname).toBe('/test')
    expect(location.search).toBe('?query=value')
    expect(location.hash).toBe('#section')

    // Test navigation
    await locationMock.navigateTo('http://example.com/new-page')
    const newLocation = await locationMock.getLocation()
    expect(newLocation.href).toBe('http://example.com/new-page')

    // Test updating specific properties
    await locationMock.updateLocation({
      pathname: '/updated-path',
      search: '?new=param'
    })

    const updatedLocation = await locationMock.getLocation()
    expect(updatedLocation.pathname).toBe('/updated-path')
    expect(updatedLocation.search).toBe('?new=param')
  })

  test('should handle location methods', async ({ page, comfyPage }) => {
    const locationMock = new LocationMock(page)

    await locationMock.setupLocationMock({
      href: 'http://localhost:5173/'
    })

    await comfyPage.goto()

    // Test location.assign
    await page.evaluate(() => {
      window.location.assign('/new-route')
    })

    // Check console for mock output
    const consoleMessages: string[] = []
    page.on('console', (msg) => {
      if (msg.text().includes('[Mock]')) {
        consoleMessages.push(msg.text())
      }
    })

    await locationMock.navigateTo('/another-route')
    await locationMock.replaceTo('/replaced-route')
    await locationMock.reload()

    // Verify mock methods were called
    expect(consoleMessages.some((msg) => msg.includes('location.assign'))).toBeTruthy()
    expect(consoleMessages.some((msg) => msg.includes('location.replace'))).toBeTruthy()
    expect(consoleMessages.some((msg) => msg.includes('location.reload'))).toBeTruthy()
  })

  test('should work with Happy DOM globals', async ({ page, comfyPage }) => {
    // Set environment variable for Happy DOM URL
    process.env.HAPPY_DOM_URL = 'http://custom-domain.com/'

    const locationMock = new LocationMock(page)
    await locationMock.setupLocationMock()

    await comfyPage.goto()

    // Verify location is mocked correctly
    const location = await page.evaluate(() => ({
      href: window.location.href,
      origin: window.location.origin,
      canAssign: typeof window.location.assign === 'function',
      canReplace: typeof window.location.replace === 'function',
      canReload: typeof window.location.reload === 'function'
    }))

    expect(location.canAssign).toBeTruthy()
    expect(location.canReplace).toBeTruthy()
    expect(location.canReload).toBeTruthy()
  })
})