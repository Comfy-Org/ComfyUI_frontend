import { test as base } from '@playwright/test'

type ElectronFixtureOptions = {
  registerDefaults?: {
    downloadManager?: boolean
  }
}

type MockFunction = {
  calls: unknown[][]
  called: () => Promise<void>
  handler?: (args: unknown[]) => unknown
}

export type MockElectronAPI = {
  setup: (method: string, handler: (args: unknown[]) => unknown) => MockFunction
}

export const electronFixture = base.extend<{
  electronAPI: MockElectronAPI
  electronOptions: ElectronFixtureOptions
}>({
  electronOptions: [
    {
      registerDefaults: {
        downloadManager: true
      }
    },
    { option: true }
  ],

  electronAPI: [
    async ({ page, electronOptions }, use) => {
      const mocks = new Map<string, MockFunction>()

      await page.exposeFunction(
        '__handleMockCall',
        async (method: string, args: unknown[]) => {
          const mock = mocks.get(method)

          if (electronOptions.registerDefaults?.downloadManager) {
            if (method === 'DownloadManager.getAllDownloads') {
              return []
            }
          }

          if (!mock) return null
          mock.calls.push(args)
          return mock.handler ? mock.handler(args) : null
        }
      )

      const createMockFunction = (
        method: string,
        handler: (args: unknown[]) => unknown
      ): MockFunction => {
        let resolveNextCall: (() => void) | null = null

        const mockFn: MockFunction = {
          calls: [],
          async called() {
            if (this.calls.length > 0) return

            return new Promise<void>((resolve) => {
              resolveNextCall = resolve
            })
          },
          handler: (args: unknown[]) => {
            const result = handler(args)
            resolveNextCall?.()
            resolveNextCall = null
            return result
          }
        }
        mocks.set(method, mockFn)

        // Add the method to the window.electronAPI object
        page.evaluate((methodName) => {
          const w = window as typeof window & {
            electronAPI: Record<string, any>
          }

          w.electronAPI[methodName] = async (...args: unknown[]) => {
            return window['__handleMockCall'](methodName, args)
          }
        }, method)

        return mockFn
      }

      const testAPI: MockElectronAPI = {
        setup(method, handler) {
          console.log('adding handler for', method)
          return createMockFunction(method, handler)
        }
      }

      await page.addInitScript(async () => {
        const getProxy = (...path: string[]) => {
          return new Proxy(() => {}, {
            // Handle the proxy itself being called as a function
            apply: async (target, thisArg, argArray) => {
              return window['__handleMockCall'](path.join('.'), argArray)
            },
            // Handle property access
            get: (target, prop: string) => {
              return getProxy(...path, prop)
            }
          })
        }

        const w = window as typeof window & {
          electronAPI: any
        }

        w.electronAPI = getProxy()
        console.log('registered electron api')
      })

      await use(testAPI)
    },
    { auto: true }
  ]
})
