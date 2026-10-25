import type { Page } from '@playwright/test'

const UNMASKED_RENDERER_WEBGL = 0x9246

// Chromium emulates client hints but not the GPU, so only the renderer
// string is stubbed.
export async function emulateWindowsOnArm(
  page: Page,
  { gpuRenderer }: { gpuRenderer: string }
) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setUserAgentOverride', {
    userAgent: await page.evaluate(() => navigator.userAgent),
    userAgentMetadata: {
      platform: 'Windows',
      platformVersion: '15.0.0',
      architecture: 'arm',
      model: '',
      mobile: false
    }
  })

  await page.addInitScript(
    ({ pname, renderer }) => {
      const getParameter = WebGLRenderingContext.prototype.getParameter
      WebGLRenderingContext.prototype.getParameter = function (
        this: WebGLRenderingContext,
        name: GLenum
      ) {
        return name === pname ? renderer : getParameter.call(this, name)
      }
    },
    { pname: UNMASKED_RENDERER_WEBGL, renderer: gpuRenderer }
  )
}
