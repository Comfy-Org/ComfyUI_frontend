import type { Page } from '@playwright/test'

/**
 * Mock location object for testing navigation and URL manipulation
 */
export class LocationMock {
  constructor(private page: Page) {}

  /**
   * Mock the location object in the page context
   * @param mockConfig Configuration for the mock location
   */
  async setupLocationMock(mockConfig?: {
    href?: string
    origin?: string
    pathname?: string
    search?: string
    hash?: string
    hostname?: string
    port?: string
    protocol?: string
  }) {
    await this.page.addInitScript((config) => {
      const defaultUrl = config?.href || window.location.href
      const url = new URL(defaultUrl)

      // Create a mock location object
      const mockLocation = {
        href: config?.href || url.href,
        origin: config?.origin || url.origin,
        protocol: config?.protocol || url.protocol,
        host: url.host,
        hostname: config?.hostname || url.hostname,
        port: config?.port || url.port,
        pathname: config?.pathname || url.pathname,
        search: config?.search || url.search,
        hash: config?.hash || url.hash,
        assign: (newUrl: string) => {
          console.log(`[Mock] location.assign called with: ${newUrl}`)
          mockLocation.href = newUrl
          // Trigger navigation event if needed
          window.dispatchEvent(new Event('popstate'))
        },
        replace: (newUrl: string) => {
          console.log(`[Mock] location.replace called with: ${newUrl}`)
          mockLocation.href = newUrl
          // Trigger navigation event if needed
          window.dispatchEvent(new Event('popstate'))
        },
        reload: () => {
          console.log('[Mock] location.reload called')
          // Trigger reload event if needed
          window.dispatchEvent(new Event('beforeunload'))
        },
        toString: () => mockLocation.href
      }

      // Override window.location
      Object.defineProperty(window, 'location', {
        value: mockLocation,
        writable: true,
        configurable: true
      })

      // Also override document.location
      Object.defineProperty(document, 'location', {
        value: mockLocation,
        writable: true,
        configurable: true
      })
    }, mockConfig)
  }

  /**
   * Update the mock location during test execution
   */
  async updateLocation(updates: Partial<{
    href: string
    pathname: string
    search: string
    hash: string
  }>) {
    await this.page.evaluate((updates) => {
      const location = window.location as any
      Object.keys(updates).forEach((key) => {
        if (location[key] !== undefined) {
          location[key] = updates[key as keyof typeof updates]
        }
      })
    }, updates)
  }

  /**
   * Get the current mock location values
   */
  async getLocation() {
    return await this.page.evaluate(() => {
      const loc = window.location
      return {
        href: loc.href,
        origin: loc.origin,
        protocol: loc.protocol,
        host: loc.host,
        hostname: loc.hostname,
        port: loc.port,
        pathname: loc.pathname,
        search: loc.search,
        hash: loc.hash
      }
    })
  }

  /**
   * Simulate navigation to a new URL
   */
  async navigateTo(url: string) {
    await this.page.evaluate((url) => {
      const location = window.location as any
      location.assign(url)
    }, url)
  }

  /**
   * Simulate location.replace
   */
  async replaceTo(url: string) {
    await this.page.evaluate((url) => {
      const location = window.location as any
      location.replace(url)
    }, url)
  }

  /**
   * Simulate location.reload
   */
  async reload() {
    await this.page.evaluate(() => {
      const location = window.location as any
      location.reload()
    })
  }
}