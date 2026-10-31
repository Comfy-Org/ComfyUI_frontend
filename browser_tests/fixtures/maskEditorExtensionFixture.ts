import { mergeTests } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import { maskEditorTest } from '@e2e/fixtures/helpers/MaskEditorHelper'
import { networkIsolationFixture } from '@e2e/fixtures/networkIsolationFixture'
import type {
  MaskEditorCommitResult,
  MaskEditorPointerEvent
} from '@comfyorg/mask-editor/extensionTypes'

async function registerTestTool(page: Page) {
  return page.evaluateHandle(() => {
    const events: MaskEditorPointerEvent[] = []
    const delayedResults: MaskEditorCommitResult[] = []
    let releaseDelayed: (() => void) | undefined
    let disposed = 0
    let unmounted = 0
    const registration = window.app!.extensionManager.maskEditor.registerTool({
      id: 'test.mask-editor-extension',
      label: 'Extension test mask',
      createSession(context) {
        const points: MaskEditorPointerEvent[] = []
        const status = document.createElement('output')
        status.setAttribute('aria-label', 'Extension test status')
        status.textContent = '0 points'
        return {
          onDocumentChange() {
            points.length = 0
            status.textContent = '0 points'
          },
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
              data.fill(42)
              snapshot.image.data.fill(17)
              status.textContent = result.ok ? 'Mask applied' : result.reason
            }
            const delayedButton = document.createElement('button')
            delayedButton.textContent = 'Start delayed mask'
            delayedButton.onclick = async () => {
              const snapshot = context.readImage()
              if (!snapshot) throw new Error('No editor image available')
              status.textContent = 'Waiting for mask'
              await new Promise<void>((resolve) => {
                releaseDelayed = resolve
              })
              const { width, height } = snapshot.image
              const result = context.commitMask(
                {
                  width,
                  height,
                  data: new Uint8Array(width * height).fill(255)
                },
                { expectedRevision: snapshot.revision }
              )
              delayedResults.push(result)
              status.textContent = result.ok
                ? 'Delayed mask applied'
                : result.reason
            }
            container.append(button, delayedButton, status)
            return () => {
              unmounted++
              button.remove()
              delayedButton.remove()
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
      events,
      delayedResults,
      releaseDelayed: () => releaseDelayed?.(),
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
  public readonly delayedApply: Locator
  public readonly pointerZone: Locator
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
    this.delayedApply = page.getByRole('button', {
      name: 'Start delayed mask',
      exact: true
    })
    this.pointerZone = page.getByTestId('pointer-zone')
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

  async getMaskAlphaValues() {
    return this.maskCanvas.evaluate((canvas) => {
      if (!(canvas instanceof HTMLCanvasElement))
        throw new Error('Not a canvas')
      const context = canvas.getContext('2d')!
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
      return [...new Set(data.filter((_, index) => index % 4 === 3))].sort(
        (left, right) => left - right
      )
    })
  }

  async uploadAsymmetricImage(input: Locator) {
    const filename = `mask-editor-asymmetric-${crypto.randomUUID()}.png`
    const encoded = await this.page.evaluate(() => {
      const canvas = document.createElement('canvas')
      canvas.width = 96
      canvas.height = 48
      const context = canvas.getContext('2d')!
      context.fillStyle = '#235a6e'
      context.fillRect(0, 0, 96, 48)
      context.fillStyle = '#ff00ff'
      context.fillRect(14, 8, 10, 8)
      context.fillStyle = '#ffff00'
      context.fillRect(60, 30, 12, 10)
      return canvas.toDataURL().split(',')[1]
    })
    await input.setInputFiles({
      name: filename,
      mimeType: 'image/png',
      buffer: Buffer.from(encoded, 'base64')
    })
    return filename
  }

  async findRenderedColor(red: number, green: number, blue: number) {
    const screenshot = await this.pointerZone.screenshot({
      animations: 'disabled'
    })
    const bounds = await this.pointerZone.boundingBox()
    expect(bounds).not.toBeNull()
    const pixels = await this.page.evaluate(
      async ({ bytes, red, green, blue }) => {
        const image = await createImageBitmap(
          new Blob([new Uint8Array(bytes)], { type: 'image/png' })
        )
        const canvas = document.createElement('canvas')
        canvas.width = image.width
        canvas.height = image.height
        const context = canvas.getContext('2d')!
        context.drawImage(image, 0, 0)
        image.close()
        const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
        let count = 0
        let xTotal = 0
        let yTotal = 0
        for (let y = 0; y < canvas.height; y++) {
          for (let x = 0; x < canvas.width; x++) {
            const offset = (y * canvas.width + x) * 4
            if (
              data[offset] === red &&
              data[offset + 1] === green &&
              data[offset + 2] === blue
            ) {
              count++
              xTotal += x + 0.5
              yTotal += y + 0.5
            }
          }
        }
        if (!count) throw new Error('Rendered color landmark missing')
        return {
          x: xTotal / count,
          y: yTotal / count,
          width: canvas.width,
          height: canvas.height
        }
      },
      { bytes: [...screenshot], red, green, blue }
    )
    return {
      x: bounds!.x + (pixels.x * bounds!.width) / pixels.width,
      y: bounds!.y + (pixels.y * bounds!.height) / pixels.height
    }
  }

  async clickRenderedLandmark() {
    const point = await this.findRenderedColor(255, 0, 255)
    await this.page.mouse.click(point.x, point.y)
    return point
  }

  async navigate(button: 'middle' | 'left') {
    const point = await this.findRenderedColor(255, 0, 255)
    await this.page.mouse.move(point.x, point.y)
    if (button === 'left') await this.page.keyboard.down('Space')
    await this.page.mouse.down({ button })
    await this.page.mouse.move(point.x + 35, point.y + 23, { steps: 5 })
    await this.page.mouse.up({ button })
    if (button === 'left') await this.page.keyboard.up('Space')
  }

  async releaseDelayedResult() {
    await this.probe!.evaluate((probe) => probe.releaseDelayed())
  }

  async getDelayedResults() {
    return this.probe!.evaluate((probe) => probe.delayedResults)
  }

  async getLifecycleCounts() {
    return this.probe!.evaluate((probe) => ({
      disposed: probe.disposed,
      unmounted: probe.unmounted
    }))
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
      for (let offset = 0; offset < rgb.data.length; offset += 4) {
        const pixel = offset / 4
        const x = pixel % rgb.width
        const y = Math.floor(pixel / rgb.width)
        changedRgbPixels += Number(
          [0, 1, 2].some(
            (channel) =>
              rgb.data[offset + channel] !== original.data[offset + channel]
          )
        )
        const expectedAlpha = x < rgb.width / 2 && y < rgb.height / 2 ? 0 : 255
        incorrectMaskPixels += Number(alpha.data[offset + 3] !== expectedAlpha)
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
