import type { Page } from '@playwright/test'

interface ReportedHardware {
  architecture: string
  gpuRenderer: string
}

// Replaces the CPU and GPU the page can observe, so Windows installer routing
// does not depend on the machine running the tests.
export async function reportHardware(page: Page, hardware: ReportedHardware) {
  await page.addInitScript(({ architecture, gpuRenderer }) => {
    Object.defineProperty(Navigator.prototype, 'userAgentData', {
      get: () => ({
        getHighEntropyValues: async () => ({ architecture })
      })
    })

    const debugRendererInfo = { UNMASKED_RENDERER_WEBGL: 0x9246 }
    const getContext = HTMLCanvasElement.prototype.getContext
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      value(this: HTMLCanvasElement, contextId: string, options?: unknown) {
        if (contextId !== 'webgl') {
          return getContext.call(this, contextId, options)
        }
        return {
          getExtension: (name: string) =>
            name === 'WEBGL_debug_renderer_info' ? debugRendererInfo : null,
          getParameter: (pname: number) =>
            pname === debugRendererInfo.UNMASKED_RENDERER_WEBGL
              ? gpuRenderer
              : null
        }
      }
    })
  }, hardware)
}
