import { mergeTests } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import { maskEditorTest } from '@e2e/fixtures/helpers/MaskEditorHelper'
import { networkIsolationFixture } from '@e2e/fixtures/networkIsolationFixture'
import type {
  MaskEditorPointerEvent,
  MaskEditorToolContext
} from '@comfyorg/mask-editor/extensionTypes'

async function registerTestTool(page: Page) {
  return page.evaluateHandle(() => {
    const contexts: MaskEditorToolContext[] = []
    const events: MaskEditorPointerEvent[] = []
    let disposed = 0
    let unmounted = 0
    const registration = window.app!.extensionManager.maskEditor.registerTool({
      id: 'test.mask-editor-extension',
      label: 'Extension test mask',
      createSession(context) {
        contexts.push(context)
        const points: MaskEditorPointerEvent[] = []
        const status = document.createElement('output')
        status.setAttribute('aria-label', 'Extension test status')
        status.textContent = '0 points'
        return {
          onPointer(event) {
            if (event.phase !== 'down' || !event.inBounds) return
            events.push(event)
            points.push(event)
            context.setOverlay(
              points.map((point, index) => ({
                id: String(index),
                x: point.x,
                y: point.y,
                radius: 3,
                color: point.button === 2 ? 'red' : 'blue'
              }))
            )
            status.textContent = `${points.length} points`
          },
          mountPanel(container) {
            const button = document.createElement('button')
            button.textContent = 'Apply test mask'
            button.onclick = () => {
              const snapshot = context.readImage()
              if (!snapshot) throw new Error('No editor image available')
              const { width, height } = snapshot.image
              const data = new Uint8Array(width * height)
              for (let y = 0; y < height / 2; y++) {
                for (let x = 0; x < width / 2; x++) {
                  data[y * width + x] = 255
                }
              }
              const result = context.commitMask(
                { width, height, data },
                { expectedRevision: snapshot.revision }
              )
              status.textContent = result.ok ? 'Mask applied' : result.reason
            }
            container.append(button, status)
            return () => {
              unmounted++
              button.remove()
              status.remove()
            }
          },
          dispose() {
            disposed++
          }
        }
      }
    })
    return {
      registration,
      contexts,
      events,
      get disposed() {
        return disposed
      },
      get unmounted() {
        return unmounted
      }
    }
  })
}

class MaskEditorExtensionHelper {
  public readonly tool: Locator
  public readonly apply: Locator
  public readonly status: Locator
  public readonly overlay: Locator
  public readonly maskCanvas: Locator
  private probe?: Awaited<ReturnType<typeof registerTestTool>>

  constructor(private readonly page: Page) {
    this.tool = page.getByRole('button', {
      name: 'Extension test mask',
      exact: true
    })
    this.apply = page.getByRole('button', {
      name: 'Apply test mask',
      exact: true
    })
    this.status = page.getByLabel('Extension test status')
    this.overlay = page.getByTestId('mask-editor-tool-overlay')
    this.maskCanvas = page.getByTestId('mask-editor-mask-canvas')
  }

  async register() {
    this.probe = await registerTestTool(this.page)
    expect(await this.probe.evaluate((probe) => probe.registration.ok)).toBe(
      true
    )
  }

  async clickImagePoint(x: number, y: number, button: 'left' | 'right') {
    const bounds = await this.maskCanvas.boundingBox()
    expect(bounds).not.toBeNull()
    const size = await this.maskCanvas.evaluate((canvas) => {
      if (!(canvas instanceof HTMLCanvasElement))
        throw new Error('Not a canvas')
      return { width: canvas.width, height: canvas.height }
    })
    await this.page.mouse.click(
      bounds!.x + (x * bounds!.width) / size.width,
      bounds!.y + (y * bounds!.height) / size.height,
      { button }
    )
  }

  async getEvents() {
    return this.probe!.evaluate((probe) => probe.events)
  }

  async getLifecycleCounts() {
    return this.probe!.evaluate((probe) => ({
      disposed: probe.disposed,
      unmounted: probe.unmounted
    }))
  }

  async applyFromClosedSession() {
    return this.probe!.evaluate((probe) =>
      probe.contexts[0].commitMask(
        { width: 64, height: 64, data: new Uint8Array(64 * 64).fill(255) },
        { expectedRevision: 0 }
      )
    )
  }

  async getWidgets() {
    return this.page.evaluate(() => {
      const node = window.app!.graph.nodes.find(
        (entry) => entry.type === 'LoadImage'
      )
      if (!node) throw new Error('LoadImage node missing')
      return (
        node.widgets?.map((widget) => ({
          name: widget.name,
          value: widget.value ?? null
        })) ?? []
      )
    })
  }

  async getSavedImageReference() {
    return this.page.evaluate(() => {
      const saved = window.app!.graph.nodes.find(
        (entry) => entry.type === 'LoadImage'
      )?.images?.[0]
      if (!saved?.filename) throw new Error('Saved image reference missing')
      return {
        filename: saved.filename,
        subfolder: saved.subfolder,
        type: saved.type
      }
    })
  }

  async inspectSavedImage() {
    return this.page.evaluate(async () => {
      const node = window.app!.graph.nodes.find(
        (entry) => entry.type === 'LoadImage'
      )
      const saved = node?.images?.[0]
      if (!saved?.filename) throw new Error('Saved image reference missing')
      const readPixels = async (parameters: Record<string, string>) => {
        const response = await fetch(
          window.app!.api.apiURL(`/view?${new URLSearchParams(parameters)}`)
        )
        if (!response.ok)
          throw new Error(`Image request failed: ${response.status}`)
        const bitmap = await createImageBitmap(await response.blob())
        const canvas = document.createElement('canvas')
        canvas.width = bitmap.width
        canvas.height = bitmap.height
        const context = canvas.getContext('2d')!
        context.drawImage(bitmap, 0, 0)
        bitmap.close()
        return context.getImageData(0, 0, canvas.width, canvas.height)
      }
      const ref = {
        filename: saved.filename,
        subfolder: saved.subfolder ?? '',
        type: saved.type ?? 'input'
      }
      const [rgb, alpha, original] = await Promise.all([
        readPixels({ ...ref, channel: 'rgb' }),
        readPixels({ ...ref, channel: 'a' }),
        readPixels({
          filename: 'image64x64.webp',
          type: 'input',
          channel: 'rgb'
        })
      ])
      let changedRgbPixels = 0
      let incorrectMaskPixels = 0
      for (let y = 0; y < rgb.height; y++) {
        for (let x = 0; x < rgb.width; x++) {
          const offset = (y * rgb.width + x) * 4
          if (
            [0, 1, 2].some(
              (channel) =>
                rgb.data[offset + channel] !== original.data[offset + channel]
            )
          ) {
            changedRgbPixels++
          }
          const expectedAlpha =
            x < rgb.width / 2 && y < rgb.height / 2 ? 0 : 255
          if (alpha.data[offset + 3] !== expectedAlpha) incorrectMaskPixels++
        }
      }
      return {
        width: rgb.width,
        height: rgb.height,
        changedRgbPixels,
        incorrectMaskPixels
      }
    })
  }

  async dispose() {
    if (!this.probe) return
    await this.probe.evaluate((probe) => {
      if (probe.registration.ok) probe.registration.unregister()
    })
    await this.probe.dispose()
  }
}

const extensionToolFixture = networkIsolationFixture.extend<{
  extensionTool: MaskEditorExtensionHelper
}>({
  extensionTool: async ({ page }, use) => {
    const helper = new MaskEditorExtensionHelper(page)
    await use(helper)
    await helper.dispose()
  }
})

export const maskEditorExtensionTest = mergeTests(
  maskEditorTest,
  extensionToolFixture
)
